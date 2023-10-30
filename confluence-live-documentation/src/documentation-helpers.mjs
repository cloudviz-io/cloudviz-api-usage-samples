import { getAllPagesInSpace, createPage, updatePage } from './confluence-api.mjs';
import { getAwsAccounts, generateLiveData } from './cloudviz-api.mjs';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

/**
 * Map Cloudviz JSON snapshot elements to document sections
 */
const documentSections = {
  Compute: ['ec2', 'lambda', 'autoScalingGroups'],
  'End User Computing': ['workSpaces'],
  Container: ['ecsClusters', 'ecsServices', 'ecsTasks', 'eksClusters'],
  Analytics: [
    'redshiftClusters',
    'redshiftClusterNodes',
    'mskClusters',
    'mskBrokerInstances',
    'esDomains',
    'kinesisDataStreams',
  ],
  'Front-end Web & Mobile': ['appSyncApis'],
  'Security, Identity & Compliance': ['directoryServices', 'wafWebAcls'],
  Storage: ['s3Buckets', 'efs'],
  Networking: [
    'Region',
    'vpc',
    'az',
    'subnet',
    'natGateways',
    'vpcEndpointInterfaces',
    'efsMountTargets',
    'elbv2',
    'igw',
    'vpnGateway',
    'vpnConnections',
    'customerGateways',
    'routers',
    'vpcEndPointGws',
    'vpcPeeringConnections',
    'cloudFrontDistributions',
    'hostedZones',
    'apiGatewayRestApis',
    'transitGateways',
  ],
  Database: ['rdsInstances', 'elasticacheInstances', 'dynamoDbTables'],
  'Application Integration': ['sqsQueues', 'snsTopics'],
  'Business Applications': ['ses'],
};

/**
 * Map Cloudviz JSON snapshot to HTML
 */
export const mapJsonSnapshotToHtml = (jsonSnapshot) => {
  let tables = '';

  // map based on document sections
  for (const [sectionsKey, sectionsValue] of Object.entries(documentSections)) {
    const resourceGroups = Object.entries(jsonSnapshot).filter(
      ([key, value]) => sectionsValue.includes(key) && value.length
    );

    let resourcesAdded = 0;

    for (const jsonResourceGroup of resourceGroups) {
      if (resourcesAdded === 0) {
        tables += `<h1>${escapeHtml(sectionsKey)}</h1>`;
      }
      resourcesAdded++;
      const elementType = jsonResourceGroup[1][0]?.ElementType;

      // Create a new table for each resource group
      tables += `<h2>${escapeHtml(elementType)}</h2>`;

      // Loop through each JSON object in the array
      for (const json of jsonResourceGroup[1]) {
        // Create the table element
        let table = '<table>';

        // Loop through each key-value pair in the JSON object
        for (let [key, value] of Object.entries(json)) {
          // Create a new table row element
          const tr = '<tr>';

          // Create a new table cell element for the key
          const keyTd = `<td><i>${escapeHtml(key)}</i></td>`;

          // Convert the value to a string
          if (typeof value === 'object' || Array.isArray(value)) {
            value = JSON.stringify(value);
          }

          // Map tags to string
          if (key === 'Tags') {
            value = JSON.parse(value)
              .map((tag) => `${tag.Key}: ${tag.Value}`)
              .join('\n\n ');
          }

          // Create a new table cell element for the value
          const valueTd = `<td>${escapeHtml(value)}</td>`;

          // Append the key and value cells to the row
          const row = `${tr}${keyTd}${valueTd}</tr>`;

          // Append the row to the table
          table += row;
        }

        // Close the table element
        table += '</table>';

        // Append the table to the tables string
        tables += table;
      }
    }
  }

  // Return the tables string
  return tables;
};

const escapeHtml = (unsafe) => {
  return typeof unsafe === 'string'
    ? unsafe
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
    : unsafe;
};

/**
 *  Generates Confluence page details based on this structure:
        AWS Account 1 (based on accountId)
            Region 1
            Region 2
        AWS Account 2 (based on accountId)
            Region 1
            Region 2
  */
const generateConfluencePageSources = async (cloudvizConfig) => {
  const { cloudvizApiKey, documentationConfig } = cloudvizConfig;
  const pageSources = [];

  const awsAccounts = await getAwsAccounts(cloudvizApiKey);

  // generate (an empty) parent (AWS account) pages
  const parentPages = awsAccounts
    .filter((account) => documentationConfig.find((config) => account.id == config.accountId))
    .map((account) => ({
      pageTitle: `${account.name} (${account.roleArn.match(/arn:aws:iam::(.+?):/)[1]})`,
      pageSource: '',
      pageImages: [],
    }));

  // generate child (region) page sources
  for (const config of documentationConfig) {
    const {
      accountId,
      region,
      format,
      queryString,
      addTextData,
      showTableOfContents,
      customPageTitle,
    } = config;

    // get parent page title
    const parentAwsAccount = awsAccounts.find((account) => account.id == accountId);
    const parentPageTitle = parentPages.find((page) =>
      page.pageTitle.includes(parentAwsAccount.name)
    ).pageTitle;

    // generate main diagram
    const diagramData = await generateLiveData(
      cloudvizApiKey,
      accountId,
      region,
      format,
      queryString
    );
    const diagramName = `${region}-${accountId}.${format}`;

    // get text data
    let textData = '';
    if (addTextData) {
      const jsonSnapshot = JSON.parse(
        await generateLiveData(
          cloudvizApiKey,
          accountId,
          region,
          'jsonSnapshot',
          `newSync=false${queryString ? `&${queryString}` : ''}`
        )
      );
      textData = mapJsonSnapshotToHtml(jsonSnapshot);
    }

    // build Confluence page source
    const pageSource = `<p><ac:image ac:height="100%" ac:width="100%"><ri:attachment ri:filename="${diagramName}" ri:version-at-save="1" /></ac:image></p>
    ${
      showTableOfContents && addTextData
        ? `<h2>Table of Contents</h2>
    <ac:structured-macro ac:name="toc">
    <ac:parameter ac:name="printable">true</ac:parameter>
    <ac:parameter ac:name="style">circle</ac:parameter>
    <ac:parameter ac:name="maxLevel">2</ac:parameter>
    <ac:parameter ac:name="indent">25px</ac:parameter>
    <ac:parameter ac:name="minLevel">1</ac:parameter>
    <ac:parameter ac:name="exclude">Table of*</ac:parameter>
    <ac:parameter ac:name="class">bigpink</ac:parameter>
    <ac:parameter ac:name="type">list</ac:parameter>
    <ac:parameter ac:name="outline">false</ac:parameter>
    <ac:parameter ac:name="include">.*</ac:parameter>
  </ac:structured-macro>`
        : ''
    }
    ${textData}`;

    pageSources.push({
      pageTitle: customPageTitle ?? `${region} (${parentAwsAccount.name})`,
      pageSource,
      pageImages: [{ imageName: `${diagramName}`, imageData: diagramData }],
      parentPageTitle,
    });
  }

  // add parent pages
  pageSources.push(...parentPages);

  return pageSources;
};

const createUpdateConfluencePages = async (confluenceConfig, currentPages, generatedPages) => {
  const mainPage = currentPages.find((page) => !page.parentId);

  // create update pages (based on title)
  for (const generatedPage of generatedPages) {
    // check if page exists
    const pageExists = currentPages.find((page) =>
      page.pageTitle.includes(generatedPage.pageTitle)
    );

    if (pageExists) {
      // update existing page
      await updatePage(confluenceConfig, {
        pageId: pageExists.pageId,
        pageTitle: pageExists.pageTitle,
        pageSource: generatedPage.pageSource,
        pageVersion: pageExists.pageVersion,
        pageImages: generatedPage.pageImages,
      });
    } else {
      // if child page doesn't exist
      if (generatedPage.parentPageTitle) {
        const parentPage = currentPages.find((page) =>
          page.pageTitle.includes(generatedPage.parentPageTitle)
        );

        // if parent page exists then create child page
        if (parentPage) {
          await createPage(confluenceConfig, {
            pageTitle: generatedPage.pageTitle,
            pageSource: generatedPage.pageSource,
            pageParentId: parentPage.pageId,
            pageImages: generatedPage.pageImages,
          });
        } else {
          // find generated parent page
          const generatedParentPage = generatedPages.find((page) =>
            page.pageTitle.includes(generatedPage.parentPageTitle)
          );
          // create parent page
          const result = await createPage(confluenceConfig, {
            pageTitle: generatedParentPage.pageTitle,
            pageSource: generatedParentPage.pageSource,
            pageParentId: mainPage.pageId,
            pageImages: generatedParentPage.pageImages,
          });
          // push to current pages in case there are other child pages
          currentPages.push({
            pageId: result.id,
            pageTitle: result.title,
            pageVersion: result.version.number,
            parentId: mainPage.pageId,
          });

          // create child page
          await createPage(confluenceConfig, {
            pageTitle: generatedPage.pageTitle,
            pageSource: generatedPage.pageSource,
            pageParentId: result.id,
            pageImages: generatedPage.pageImages,
          });
        }
      } else {
        // if parent page doesn't exists then create parent page
        const result = await createPage(confluenceConfig, {
          pageTitle: generatedPage.pageTitle,
          pageSource: generatedPage.pageSource,
          pageParentId: mainPage.pageId,
          pageImages: generatedPage.pageImages,
        });
        currentPages.push({
          pageId: result.id,
          pageTitle: result.title,
          pageVersion: result.version.number,
        });
      }
    }
  }
};

/**
 * Update Confluence page with Cloudviz diagrams and text data
 */
export const generateAndUpdateDocumentation = async (confluenceConfig, cloudvizConfig) => {
  // get all pages in space
  const currentPages = await getAllPagesInSpace(confluenceConfig);

  // generate Confluence page details using Cloudviz API data
  const generatedPages = await generateConfluencePageSources(cloudvizConfig);

  // create or update Confluence pages
  await createUpdateConfluencePages(confluenceConfig, currentPages, generatedPages);
};

/**
 * Get secret from AWS Systems Manager Parameter Store
 */
export const getSecretFromParameterStore = async (parameterName) => {
  const ssmClient = new SSMClient({
    region: process.env.AWS_REGION || 'eu-west-1',
  });
  const command = new GetParameterCommand({
    Name: parameterName,
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  return response.Parameter.Value;
};
