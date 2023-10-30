# Live Documentation in Confluence
This is functional example for generating AWS documentation based on live data from your AWS environments and keeping always up-to-date documentation in Confluence

## Documentation Page Structure
  
![](img/confluence-aws-documentation.gif)
  
This is example result page structure in Confluence:
```
AWS Account 1  
-----Region 1  
-----Region 2
-----Application Name
  
AWS Account 2  
-----Region 1  
-----Region 2  
```

## Configuration
Configuration parameters help to generate documentation using [Cloudviz API](https://cloudviz.io/developers) and updating Confluence. We have added few options to customize (like set multiple aws account and region combinations, custom page titles etc.) documentation generation.
- Cloudviz configuration (`CLOUDVIZ_CONFIG`) parameters:

| Parameter             | Type   | Description  |
| -------------         |:-------------:| -----:|
| cloudvizApiKey        | String  |    Your Cloudviz API key |
| accountId             | String  |   Cloudviz AWS account id     |
| documentationConfig     | Array of Objects  | See example below     |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;region                | String |    AWS region (ex. us-east-1)  |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;format                | String |   Diagram image format ("svg" or "png")|
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;queryString           | String |   Query string to use filter or generationProfileId parameters (see [Cloudviz API](https://cloudviz.io/developers) documentation) |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;addTextData           |  Boolean     |  Show/hide text data |
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;showTableOfContents   | Boolean  |    Show/hide table of contents|
| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;customPageTitle  | String  |   Overrides automated page title with custom one. This should be unique title in the Confluence space |
  
- Confluence configuration (`CONFLUENCE_CONFIG`) parameters:
  
| Parameter             | Description   | Cool  |
| -------------         |:-------------:| -----:|
| confluenceSpaceId        | Number | Confluence space id where live documentation will be placed. Documentation pages will be created under Space default homepage |
| confluenceUrl             | String     | Full Confluence url ex. "https://<your-confluence-name>.atlassian.net" |
| confluenceApiToken                | String  |  Confluence API token |
| confluenceUserName                | String     | Confluence user name ex. "your@email.com"  |


## Deployment

### Create Parameters
Create two configuration parameters (as SecureString) in [AWS Systems Manager Parameter Store](https://eu-west-1.console.aws.amazon.com/systems-manager/parameters):

- `CLOUDVIZ_CONFIG`
```
{
  "cloudvizApiKey": "<your-cloudviz-api-key>",
  "documentationConfig": [
    {
      "accountId": "123456-1234-1234-1234-1234567",
      "region": "eu-west-1",
      "format": "svg",
      "queryString": "",
      "addTextData": true,
      "showTableOfContents": true
    }
  ]
}
```

- `CONFLUENCE_CONFIG`
```
{
    "confluenceSpaceId": "123456",
    "confluenceUrl": "https://<your-confluence-name>.atlassian.net",
    "confluenceApiToken": "<confluence-api-key>",
    "confluenceUserName": "your@email.com" 
}
```

### Install Dependencies

`npm install` install all the dependencies

### Deployment to AWS

`npm run deploy --stage <name> --region <aws-region>` will deploy simple `confluence-live-documentation` service to your AWS account (not mandatory to be your account that you document)