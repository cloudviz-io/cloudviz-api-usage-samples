/**
 * Generate live Cloudviz diagram or JSON data
 */
export const generateLiveData = async (cloudvizApiKey, accountId, region, format, queryString) => {
  return await getCloudvizData(
    cloudvizApiKey,
    `aws/accounts/${accountId}/${region}/${format}${queryString ? `?${queryString}` : ''}`
  );
};

/**
 * Get connected AWS account details from Cloudviz
 */
export const getAwsAccounts = async (cloudvizApiKey) => {
  return JSON.parse(await getCloudvizData(cloudvizApiKey, `aws/accounts/`)).accounts;
};

/**
 * Generic function to get data from Cloudviz API
 */
export const getCloudvizData = async (
  cloudvizApiKey,
  path,
  retryAfter = 10 // default API call retry after 10 seconds
) => {
  // Set the API key header, output file, account id and region
  const headers = {
    'x-api-key': cloudvizApiKey,
  };

  // Set the API endpoint URL
  const url = `https://api.cloudviz.io/${path}`;

  try {
    let response = await fetch(url, { headers });
    let retries = 0;

    // Check if the response is 202 Accepted or 429 Too Many Requests
    while ([202, 429].includes(response.status)) {
      // if it's 429 Too Many Requests use small delay, otherwise use retryAfter parameter
      let overrideRetryAfter = response.status === 429 ? 0.5 : retryAfter;
      retries++;
      console.log(
        `Request returned ${response.status} ${response.statusText}, retrying in ${overrideRetryAfter} seconds (attempt ${retries})...`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, overrideRetryAfter * 1000)
      );
      response = await fetch(url, { headers });
    }

    // Check if the response is not 200 OK
    if (response.status !== 200) {
      throw new Error(
        `Cloudviz API request failed with status code ${response.status} ${response.statusText}`
      );
    }

    console.log(`Cloudviz API request successful: GET ${path}`);

    // get blob when generating png or pdf
    if (path.includes('/png') || path.includes('/pdf')) {
      return await response.blob();
    } else {
      return await response.text();
    }
  } catch (error) {
    throw new Error(`Failed to run Cloudviz API request: GET ${path} ${error}`);
  }
};
