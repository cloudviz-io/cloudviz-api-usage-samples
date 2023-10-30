import {
  generateAndUpdateDocumentation,
  getSecretFromParameterStore,
} from './documentation-helpers.mjs';

/**
 * Lambda handler to update Confluence page with Cloudviz diagrams and text data.
 * To be triggered by scheduled event (see serverless.yml)
 */
export const handler = async (event) => {
  // read configuration values config from AWS System Manager Parameter Store
  const cloudvizConfig = JSON.parse(await getSecretFromParameterStore('CLOUDVIZ_CONFIG'));
  const confluenceConfig = JSON.parse(await getSecretFromParameterStore('CONFLUENCE_CONFIG'));

  await generateAndUpdateDocumentation(confluenceConfig, cloudvizConfig);
};
