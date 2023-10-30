/**
 * Generate Confluence basic auth header
 */
const confluenceAuthHeader = (confluenceUserName, confluenceApiToken) => {
  return {
    Authorization: `Basic ${Buffer.from(`${confluenceUserName}:${confluenceApiToken}`).toString(
      'base64'
    )}`,
  };
};

/**
 * Get all pages in Confluence space
 */
export const getAllPagesInSpace = async (confluenceConfig) => {
  const { confluenceUrl, confluenceApiToken, confluenceUserName, confluenceSpaceId } =
    confluenceConfig;

  // Get all pages in Confluence space
  // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-spaces-id-pages-get
  const response = await fetch(`${confluenceUrl}/wiki/api/v2/spaces/${confluenceSpaceId}/pages`, {
    method: 'GET',
    headers: {
      ...confluenceAuthHeader(confluenceUserName, confluenceApiToken),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to update page: ${response.status} ${response.statusText}`);
  }

  // map the result to array of objects with id, title, version and parentId
  return (
    (await response.json()).results?.map((page) => ({
      pageId: page.id,
      parentId: page.parentId,
      pageTitle: page.title,
      pageVersion: page.version.number,
    })) || []
  );
};

/**
 * Upload an attachment to a Confluence page
 */
export const uploadAttachment = async (confluenceConfig, pageId, fileData, fileName) => {
  const { confluenceUrl, confluenceApiToken, confluenceUserName } = confluenceConfig;

  const body = new FormData();
  body.set('file', new Blob([fileData]), fileName);
  body.set('minorEdit', 'true');

  // Upload the file to Confluence
  const response = await fetch(
    `${confluenceUrl}/wiki/rest/api/content/${pageId}/child/attachment`,
    {
      method: 'PUT',
      headers: {
        ...confluenceAuthHeader(confluenceUserName, confluenceApiToken),
        'X-Atlassian-Token': 'nocheck',
      },
      body,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload attachment: ${response.status} ${response.statusText}`);
  }

  console.log(`Attachment uploaded successfully: ${fileName}`);
};

/**
 * Update Confluence page
 */
export const updatePage = async (confluenceConfig, pageDetails) => {
  const { confluenceUrl, confluenceApiToken, confluenceUserName } = confluenceConfig;

  const { pageId, pageTitle, pageSource, pageVersion, pageImages } = pageDetails;

  // Upload images to the page
  for (const image of pageImages) {
    await uploadAttachment(confluenceConfig, pageId, image.imageData, image.imageName);
  }

  // Update page
  // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-put
  const response = await fetch(`${confluenceUrl}/wiki/api/v2/pages/${pageId}`, {
    method: 'PUT',
    headers: {
      ...confluenceAuthHeader(confluenceUserName, confluenceApiToken),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      id: pageId,
      status: 'current',
      title: pageTitle,
      body: {
        representation: 'storage',
        value: pageSource,
      },
      version: {
        number: pageVersion + 1, // Increment the version number
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update page: ${response.status} ${response.statusText}`);
  }

  await response.json();

  console.log(`Page updated successfully: ${pageTitle}`);
};

/**
 * Create Confluence page
 */
export const createPage = async (confluenceConfig, pageDetails) => {
  const { confluenceUrl, confluenceApiToken, confluenceUserName, confluenceSpaceId } =
    confluenceConfig;
  const { pageParentId, pageTitle, pageSource, pageImages } = pageDetails;

  // Create page
  // https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-post
  const response = await fetch(`${confluenceUrl}/wiki/api/v2/pages`, {
    method: 'POST',
    headers: {
      ...confluenceAuthHeader(confluenceUserName, confluenceApiToken),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      spaceId: confluenceSpaceId,
      parentId: pageParentId,
      title: pageTitle,
      body: {
        representation: 'storage',
        value: pageSource,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create page: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  // Upload images to the page
  for (const image of pageImages) {
    await uploadAttachment(confluenceConfig, result.id, image.imageData, image.imageName);
  }

  console.log(`Page created successfully: ${pageTitle}`);

  return result;
};
