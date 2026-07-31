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

@description('Deploy the Azure AI Foundry account and model used to phrase assistant answers. When false the app uses the deterministic local adapter, which supplies all legal substance in either case.')
param enableFoundryAssistant bool = true

@description('Model deployed to Foundry for the assistant.')
param foundryModelName string = 'gpt-5.6-sol'

@description('Version of the Foundry model.')
param foundryModelVersion string = '2026-07-09'

@description('Thousands of tokens per minute provisioned for the model deployment.')
param foundryModelCapacity int = 50

@description('Azure OpenAI data-plane API version. Newer models reject older versions, so this is a parameter rather than a constant.')
param foundryApiVersion string = '2025-04-01-preview'

@description('Run the assistant as a Foundry Agent Service agent with a retrieval tool, rather than as a single pre-grounded chat completion. Falls back to the chat model, then to the local adapter.')
param enableFoundryAgent bool = true

@description('Model the Agent Service runs. The Agent Service always sends top_p, which gpt-5.5 and the gpt-5.6 family reject, so this cannot simply track foundryModelName.')
param foundryAgentModelName string = 'gpt-5.1'

@description('Version of the Agent Service model.')
param foundryAgentModelVersion string = '2025-11-13'

@description('Thousands of tokens per minute for the Agent Service model. Drawn from the regional Standard pool, not the GlobalStandard one.')
param foundryAgentCapacity int = 50

@description('Agent Service data-plane API version.')
param foundryAgentApiVersion string = '2025-05-01'

var uniqueSuffix = uniqueString(resourceGroup().id, namePrefix, environmentName)

// Resource names are computed once, here, from parameters/variables only
// (never from another module's output) so they stay usable as the
// `name`/`scope`/`parent` of extension resources (role assignments, the
// appsettings config resource, diagnostic settings) below — those
// properties must be resolvable before any nested module deployment runs.
var storageAccountName = toLower(take('stg${replace(namePrefix, '-', '')}${environmentName}${uniqueSuffix}', 24))
var keyVaultName = toLower(take('kv-${replace(namePrefix, '-', '')}${environmentName}${uniqueSuffix}', 24))
var webAppName = '${namePrefix}-${environmentName}-app'
// Foundry account names form a public DNS label, so they must be globally
// unique and lower-case. Computed here with the other names, from parameters
// only, so it can be referenced as a `scope` below.
var foundryAccountName = toLower(take('ai-${replace(namePrefix, '-', '')}-${environmentName}-${uniqueSuffix}', 24))
var foundryDeploymentName = foundryModelName
// Project names allow only alphanumerics and hyphens, and must be unique
// within the account rather than globally.
var foundryProjectName = toLower(take('proj-${replace(namePrefix, '-', '')}-${environmentName}', 32))

// Built here (not by a role-assignment GUID literal) so the same role
// definition ID always maps to a stable, idempotent assignment name.

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

// Azure AI Foundry. Optional by design: the assistant's legal substance comes
// from the statutory corpus in this repository either way, and every failure
// path in the Foundry adapter falls back to the deterministic local one. This
// exists to improve phrasing, not to supply facts.
module foundry 'modules/foundry.bicep' = if (enableFoundryAssistant) {
  name: 'foundry'
  params: {
    location: location
    tags: tags
    accountName: foundryAccountName
    deploymentName: foundryDeploymentName
    modelName: foundryModelName
    modelVersion: foundryModelVersion
    capacity: foundryModelCapacity
    agentModelName: foundryAgentModelName
    agentModelVersion: foundryAgentModelVersion
    agentCapacity: foundryAgentCapacity
    projectName: foundryProjectName
    privateLinkSubnetId: network.outputs.privateEndpointSubnetId
    virtualNetworkId: network.outputs.vnetId
    principalId: appService.outputs.webAppPrincipalId
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
// "N/A" on cold start). See modules/role-assignments.bicep for why these are
// a module rather than inline resources. ---

module roleAssignments 'modules/role-assignments.bicep' = {
  name: 'role-assignments'
  params: {
    principalId: appService.outputs.webAppPrincipalId
    keyVaultName: keyVault.outputs.keyVaultName
    storageAccountName: storage.outputs.storageAccountName
  }
}

// --- Private endpoints for Key Vault and Storage ---
//
// Tenant governance policy forces publicNetworkAccess to Disabled on both
// resource types after deployment, so these are the only route App Service
// has to them. Without them the Key Vault references in the app settings
// below resolve to AccessToKeyVaultDenied and the app starts with unusable
// configuration -- while the deployment itself still reports success.

resource keyVaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (enablePrivateNetworking) {
  name: '${namePrefix}-${environmentName}-kv-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: network.outputs.privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'keyvault'
        properties: {
          privateLinkServiceId: keyVaultExisting.id
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
  dependsOn: [
    keyVault
  ]
}

resource keyVaultPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (enablePrivateNetworking) {
  parent: keyVaultPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vaultcore'
        properties: {
          privateDnsZoneId: network.outputs.keyVaultPrivateDnsZoneId
        }
      }
    ]
  }
}

resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (enablePrivateNetworking) {
  name: '${namePrefix}-${environmentName}-blob-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: network.outputs.privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'blob'
        properties: {
          privateLinkServiceId: storageAccountExisting.id
          groupIds: [
            'blob'
          ]
        }
      }
    ]
  }
  dependsOn: [
    storage
  ]
}

resource blobPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = if (enablePrivateNetworking) {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: {
          privateDnsZoneId: network.outputs.blobPrivateDnsZoneId
        }
      }
    ]
  }
}

// Single, complete app settings write — see modules/app-service.bicep for
// why this isn't split across two writes. Explicitly depends on both role
// assignments above.
resource appSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: webApp
  name: 'appsettings'
  properties: union({
    WEBSITE_NODE_DEFAULT_VERSION: '~24'
    // Required for regional VNet integration to resolve the private DNS zones
    // above (and the Postgres one); without it lookups go to public DNS and
    // return the public IP, which is blocked.
    WEBSITE_DNS_SERVER: '168.63.129.16'
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
  }, enableFoundryAssistant ? {
    ASSISTANT_PROVIDER: enableFoundryAgent ? 'agent' : 'foundry'
    AZURE_FOUNDRY_ENDPOINT: foundry!.outputs.endpoint
    AZURE_FOUNDRY_DEPLOYMENT: foundry!.outputs.deploymentName
    AZURE_FOUNDRY_API_VERSION: foundryApiVersion
    // Always set, even when the agent is off, so the chat adapter and the
    // agent adapter differ only by ASSISTANT_PROVIDER and switching back is
    // a one-setting change rather than a redeploy.
    AZURE_FOUNDRY_PROJECT_ENDPOINT: foundry!.outputs.projectEndpoint
    AZURE_FOUNDRY_AGENT_MODEL: foundry!.outputs.agentModelName
    AZURE_FOUNDRY_AGENT_API_VERSION: foundryAgentApiVersion
  } : {
    ASSISTANT_PROVIDER: 'local'
  })
  dependsOn: [
    roleAssignments
    keyVaultPrivateDnsZoneGroup
    blobPrivateDnsZoneGroup
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
