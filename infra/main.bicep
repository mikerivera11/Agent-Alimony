// Subscription-scope entry point. Creates the target resource group in East
// US 2 and deploys every application resource into it.
//
// Deploy with (see scripts/azure/deploy-infra.sh for the full flow):
//   az account set --subscription "<subscription-id-or-name>"
//   az deployment sub create \
//     --name fsg-infra \
//     --location eastus2 \
//     --template-file infra/main.bicep \
//     --parameters infra/main.parameters.json \
//     --parameters postgresAdminPassword="$PG_ADMIN_PASSWORD" sessionSigningSecret="$SESSION_SIGNING_SECRET"
//
// No tenant ID, subscription ID, or secret is hard-coded anywhere in this
// template: the subscription is whichever one `az account set` selected,
// and the two secure parameters must be supplied at deploy time (e.g. from
// environment variables), never committed to source control.
targetScope = 'subscription'

@description('Name prefix shared by every resource in this deployment (tenant-independent, 3-10 lowercase alphanumeric characters, e.g. "fsg").')
@minLength(3)
@maxLength(10)
param namePrefix string

@description('Deployment environment token, e.g. dev, test, prod.')
@minLength(2)
@maxLength(10)
param environmentName string

@description('Azure region. The tenant target for this deployment is East US 2.')
param location string = 'eastus2'

@description('PostgreSQL administrator login. Not a secret, but avoid predictable values such as "postgres" or "admin".')
param postgresAdminLogin string

@secure()
@description('PostgreSQL administrator password. Supply via an environment variable at deploy time; never hard-code or commit it.')
param postgresAdminPassword string

@secure()
@description('Session-signing secret, at least 32 characters. Supply via an environment variable at deploy time; never hard-code or commit it.')
param sessionSigningSecret string

@description('App Service Plan SKU. Must be Basic (B1) or higher to support regional VNet integration.')
param appServicePlanSkuName string = 'P1v3'

@description('PostgreSQL Flexible Server compute SKU name.')
param postgresSkuName string = 'Standard_B1ms'

@description('PostgreSQL Flexible Server pricing tier matching postgresSkuName.')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param postgresSkuTier string = 'Burstable'

@description('PostgreSQL allocated storage in GiB.')
param postgresStorageSizeGB int = 32

@description('Application database name.')
param postgresDatabaseName string = 'florida_support'

@description('When true (default), PostgreSQL is deployed with a delegated VNet subnet + private DNS zone and has no public network access; App Service gets regional VNet integration to reach it. When false, PostgreSQL falls back to public network access allowlisted to the App Service outbound IPs only — a deliberate, non-private MVP tradeoff. See README Azure section.')
param enablePrivateNetworking bool = true

@description('Log Analytics retention in days.')
param logRetentionDays int = 30

@description('Tags applied to every resource.')
param tags object = {}

var resourceGroupName = '${namePrefix}-${environmentName}-rg'

resource rg 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    postgresAdminLogin: postgresAdminLogin
    postgresAdminPassword: postgresAdminPassword
    sessionSigningSecret: sessionSigningSecret
    appServicePlanSkuName: appServicePlanSkuName
    postgresSkuName: postgresSkuName
    postgresSkuTier: postgresSkuTier
    postgresStorageSizeGB: postgresStorageSizeGB
    postgresDatabaseName: postgresDatabaseName
    enablePrivateNetworking: enablePrivateNetworking
    logRetentionDays: logRetentionDays
    tags: tags
  }
}

output resourceGroupName string = rg.name
output webAppName string = resources.outputs.webAppName
output webAppUrl string = resources.outputs.webAppUrl
output storageAccountName string = resources.outputs.storageAccountName
output keyVaultName string = resources.outputs.keyVaultName
output postgresServerName string = resources.outputs.postgresServerName
output postgresIsPrivate bool = resources.outputs.postgresIsPrivate
output appInsightsName string = resources.outputs.appInsightsName
