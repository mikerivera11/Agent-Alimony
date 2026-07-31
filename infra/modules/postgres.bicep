// Azure Database for PostgreSQL Flexible Server + application database.
//
// When `delegatedSubnetId`/`privateDnsZoneId` are supplied (the default,
// production-conscious path), the server is created with VNet-injected
// "private access" networking: Flexible Server does not expose a public
// endpoint at all in this mode, there is no firewall rule to misconfigure,
// and name resolution is handled by the linked private DNS zone. This is
// Azure's supported private-networking pattern for Flexible Server (it does
// not use Private Link/private endpoints the way Storage/Key Vault do).
//
// When the caller omits those values (`enablePrivateNetworking=false` at the
// orchestration layer), the server falls back to public network access
// allowlisted only to the App Service's possible outbound IP addresses. That
// fallback is a deliberate, clearly-labeled MVP tradeoff for tenants that
// cannot yet provision VNets — see the README Azure section — and it is NOT
// private.
targetScope = 'resourceGroup'

@description('Name prefix shared by every resource in this deployment.')
param namePrefix string

@description('Deployment environment token, e.g. dev, test, prod.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

@description('PostgreSQL administrator login name (not a secret, but must not be "postgres" or another reserved/predictable name).')
param administratorLogin string

@secure()
@description('PostgreSQL administrator password. Never hard-code; supply via environment variable at deploy time.')
param administratorPassword string

@description('Application database name.')
param databaseName string = 'florida_support'

@description('Flexible Server compute SKU, e.g. Standard_B1ms (Burstable) or Standard_D2ds_v5 (General Purpose).')
param skuName string = 'Standard_B1ms'

@description('Flexible Server pricing tier matching skuName.')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param skuTier string = 'Burstable'

@description('Allocated storage in GiB.')
param storageSizeGB int = 32

@description('PostgreSQL major version.')
param postgresVersion string = '16'

@description('Subnet resource ID delegated to Microsoft.DBforPostgreSQL/flexibleServers. Omit to fall back to public network access.')
param delegatedSubnetId string = ''

@description('Private DNS zone resource ID (privatelink.postgres.database.azure.com) linked to the VNet. Omit to fall back to public network access.')
param privateDnsZoneId string = ''

@description('App Service outbound IP addresses allowed only when private networking is disabled.')
param allowedPublicIpAddresses array = []

var usePrivateNetworking = !empty(delegatedSubnetId) && !empty(privateDnsZoneId)
var serverName = '${namePrefix}-${environmentName}-psql'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: usePrivateNetworking
      ? {
          delegatedSubnetResourceId: delegatedSubnetId
          privateDnsZoneArmResourceId: privateDnsZoneId
        }
      : null
  }
}

// Public-access fallback: only reachable when the server was NOT deployed
// with a delegated subnet. Each rule admits one possible App Service outbound
// address; unlike Azure's 0.0.0.0 rule, this does not trust other tenants.
resource allowAppServiceOutbound 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [
  for (ipAddress, index) in allowedPublicIpAddresses: if (!usePrivateNetworking) {
    parent: postgresServer
    name: 'AllowAppServiceOutbound${index}'
    properties: {
      startIpAddress: ipAddress
      endIpAddress: ipAddress
    }
  }
]

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output serverName string = postgresServer.name
output fullyQualifiedDomainName string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output isPrivate bool = usePrivateNetworking
