// Resource-group-scoped orchestrator. Deployed by infra/main.bicep (which
// creates the resource group at subscription scope) or directly against an
// existing resource group — see README "Local Git and infrastructure
// deployment" for both invocation styles.
targetScope = 'resourceGroup'

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

@description('When true (default), PostgreSQL is deployed with a delegated VNet subnet + private DNS zone and has no public network access; App Service gets regional VNet integration to reach it. When false, PostgreSQL falls back to public network access allowlisted to the App Service outbound IPs only — a deliberate, non-private MVP tradeoff for tenants that cannot yet provision VNets. Storage and Key Vault security in this template (TLS, RBAC, disabled shared-key/anonymous access) is unaffected either way.')
param enablePrivateNetworking bool = true

@description('Log Analytics retention in days.')
param logRetentionDays int = 30

@description('Tags applied to every resource.')
param tags object = {}

var uniqueSuffix = uniqueString(resourceGroup().id, namePrefix, environmentName)

// Resource names are computed once, here, from parameters/variables only
// (never from another module's output) so they stay usable as the
// `name`/`scope`/`parent` of extension resources (role assignments, the
// appsettings config resource, diagnostic settings) below — those
// properties must be resolvable before any nested module deployment runs.
var storageAccountName = toLower(take('stg${replace(namePrefix, '-', '')}${environmentName}${uniqueSuffix}', 24))
var keyVaultName = toLower(take('kv-${replace(namePrefix, '-', '')}${environmentName}${uniqueSuffix}', 24))
var webAppName = '${namePrefix}-${environmentName}-app'

// Built here (not by a role-assignment GUID literal) so the same role
// definition ID always maps to a stable, idempotent assignment name.
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: tags
    logRetentionDays: logRetentionDays
  }
}

// Always provisioned (VNets/private DNS zones cost nothing meaningful on
// their own). `enablePrivateNetworking` controls only whether Postgres and
// App Service actually reference these subnets below, so the tradeoff can be
// flipped later without re-touching this module.
module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: tags
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: tags
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
    databaseName: postgresDatabaseName
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    storageSizeGB: postgresStorageSizeGB
    delegatedSubnetId: enablePrivateNetworking ? network.outputs.postgresSubnetId : ''
    privateDnsZoneId: enablePrivateNetworking ? network.outputs.postgresPrivateDnsZoneId : ''
    allowedPublicIpAddresses: split(appService.outputs.possibleOutboundIpAddresses, ',')
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    tags: tags
    storageAccountName: storageAccountName
  }
}

var databaseUrl = 'postgres://${uriComponent(postgresAdminLogin)}:${uriComponent(postgresAdminPassword)}@${postgres.outputs.fullyQualifiedDomainName}:5432/${postgres.outputs.databaseName}?sslmode=require'

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    location: location
    tags: tags
    keyVaultName: keyVaultName
    databaseUrl: databaseUrl
    sessionSigningSecret: sessionSigningSecret
  }
}

module appService 'modules/app-service.bicep' = {
  name: 'appservice'
  params: {
    namePrefix: namePrefix
    environmentName: environmentName
    location: location
    tags: tags
    webAppName: webAppName
    appServicePlanSkuName: appServicePlanSkuName
    vnetIntegrationSubnetId: enablePrivateNetworking ? network.outputs.appServiceSubnetId : ''
  }
}

resource storageAccountExisting 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource keyVaultExisting 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource webApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: webAppName
}

// --- Managed-identity role assignments (must exist before the Key Vault
// reference app settings are applied, so App Service never resolves them as
// "N/A" on cold start) ---

resource storageBlobDataContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountExisting.id, webAppName, storageBlobDataContributorRoleId)
  scope: storageAccountExisting
  properties: {
    principalId: appService.outputs.webAppPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
  }
  dependsOn: [
    storage
  ]
}

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultExisting.id, webAppName, keyVaultSecretsUserRoleId)
  scope: keyVaultExisting
  properties: {
    principalId: appService.outputs.webAppPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
  dependsOn: [
    keyVault
  ]
}

// Single, complete app settings write — see modules/app-service.bicep for
// why this isn't split across two writes. Explicitly depends on both role
// assignments above.
resource appSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: webApp
  name: 'appsettings'
  properties: {
    WEBSITE_NODE_DEFAULT_VERSION: '~24'
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
    APP_BASE_URL: 'https://${appService.outputs.webAppDefaultHostName}'
    STORAGE_PROVIDER: 'azure'
    AZURE_STORAGE_ACCOUNT_NAME: storage.outputs.storageAccountName
    AZURE_UPLOAD_CONTAINER: storage.outputs.sourceDocumentsContainerName
    AZURE_PACKAGE_CONTAINER: storage.outputs.generatedPackagesContainerName
    AZURE_KEY_VAULT_URL: keyVault.outputs.keyVaultUri
    EXTRACTION_PROVIDER: 'mock'
    APPLICATIONINSIGHTS_CONNECTION_STRING: monitoring.outputs.appInsightsConnectionString
    ApplicationInsightsAgent_EXTENSION_VERSION: '~3'
    DATABASE_URL: '@Microsoft.KeyVault(SecretUri=${keyVault.outputs.databaseUrlSecretUri})'
    SESSION_SIGNING_SECRET: '@Microsoft.KeyVault(SecretUri=${keyVault.outputs.sessionSigningSecretUri})'
  }
  dependsOn: [
    storageBlobDataContributorAssignment
    keyVaultSecretsUserAssignment
  ]
}

resource appServiceDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'appservice-to-log-analytics'
  scope: webApp
  properties: {
    workspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
  dependsOn: [
    appService
  ]
}

output resourceGroupName string = resourceGroup().name
output webAppName string = appService.outputs.webAppName
output webAppDefaultHostName string = appService.outputs.webAppDefaultHostName
output webAppUrl string = 'https://${appService.outputs.webAppDefaultHostName}'
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultName string = keyVault.outputs.keyVaultName
output postgresServerName string = postgres.outputs.serverName
output postgresIsPrivate bool = postgres.outputs.isPrivate
output appInsightsName string = monitoring.outputs.appInsightsName
