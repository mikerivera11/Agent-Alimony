// Workspace-based Application Insights + its backing Log Analytics
// workspace. No application code in this repo intentionally logs raw
// document bytes, extracted financial values, or secrets (see
// src/server/**); this module only wires up the collection plumbing.
targetScope = 'resourceGroup'

@description('Name prefix shared by every resource in this deployment.')
param namePrefix string

@description('Deployment environment token, e.g. dev, test, prod.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

@description('Log Analytics data retention in days.')
param logRetentionDays int = 30

var logAnalyticsWorkspaceName = '${namePrefix}-${environmentName}-logs'
var appInsightsName = '${namePrefix}-${environmentName}-insights'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: logRetentionDays
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
  }
}

output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output appInsightsName string = appInsights.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
