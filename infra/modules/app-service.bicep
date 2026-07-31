// App Service Plan (Linux) + Web App running the Next.js server on
// Node 24. This module intentionally does NOT set app settings (the
// `config/appsettings` resource replaces the *entire* settings collection on
// every write, so mixing a partial set here with a later, more complete
// write from the orchestrator would race). The orchestrator template applies
// the full app settings list — including the two Key Vault-reference secret
// settings — in one explicit resource that `dependsOn` the Key Vault RBAC
// role assignment, so Key Vault references never resolve before the
// managed identity actually has access.
targetScope = 'resourceGroup'

@description('Name prefix shared by every resource in this deployment.')
param namePrefix string

@description('Deployment environment token, e.g. dev, test, prod.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

@description('App Service (Web App) resource name, computed by the caller so it is known before any nested module deployment runs.')
param webAppName string

@description('App Service Plan SKU name, e.g. P1v3. Must be Basic (B1) or higher to support regional VNet integration.')
param appServicePlanSkuName string = 'P1v3'

@description('Subnet resource ID for outbound regional VNet integration. Omit to run without VNet integration (public-only PostgreSQL fallback).')
param vnetIntegrationSubnetId string = ''

var appServicePlanName = '${namePrefix}-${environmentName}-plan'
var usesVnetIntegration = !empty(vnetIntegrationSubnetId)

resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: appServicePlanSkuName
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    virtualNetworkSubnetId: usesVnetIntegration ? vnetIntegrationSubnetId : null
    vnetRouteAllEnabled: usesVnetIntegration
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appCommandLine: 'npm run start'
    }
  }
}

// Local Git deployment (this project's chosen release mechanism) goes
// through SCM/Kudu basic auth, so it must stay explicitly enabled even
// though FTP/FTPS is fully disabled above. Declaring both policies
// explicitly (rather than relying on the platform default) keeps this
// tenant-auditable instead of implicit.
resource scmBasicAuthPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: webApp
  name: 'scm'
  properties: {
    allow: true
  }
}

resource ftpBasicAuthPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: webApp
  name: 'ftp'
  properties: {
    allow: false
  }
}

output webAppName string = webApp.name
output webAppDefaultHostName string = webApp.properties.defaultHostName
output webAppPrincipalId string = webApp.identity.principalId
output appServicePlanId string = appServicePlan.id
output possibleOutboundIpAddresses string = webApp.properties.possibleOutboundIpAddresses
