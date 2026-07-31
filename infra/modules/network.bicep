// Virtual network providing genuine network isolation for PostgreSQL Flexible
// Server, Key Vault, and Storage. App Service gets regional VNet integration (outbound only) so it can
// reach the privately-injected database; PostgreSQL itself is deployed with a
// delegated subnet + private DNS zone, which is Azure's supported "no public
// network access" pattern for Flexible Server (as opposed to a private
// endpoint, which Flexible Server does not use).
targetScope = 'resourceGroup'

@description('Name prefix shared by every resource in this deployment.')
param namePrefix string

@description('Deployment environment token, e.g. dev, test, prod.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Tags applied to every resource in this module.')
param tags object

var vnetName = '${namePrefix}-${environmentName}-vnet'
var appServiceSubnetName = 'snet-appservice'
var postgresSubnetName = 'snet-postgres'
var privateEndpointSubnetName = 'snet-privatelink'
var privateDnsZoneName = 'privatelink.postgres.database.azure.com'
var keyVaultPrivateDnsZoneName = 'privatelink.vaultcore.azure.net'
var blobPrivateDnsZoneName = 'privatelink.blob.${environment().suffixes.storage}'

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: appServiceSubnetName
        properties: {
          addressPrefix: '10.20.0.0/24'
          delegations: [
            {
              name: 'appServiceDelegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: postgresSubnetName
        properties: {
          addressPrefix: '10.20.1.0/24'
          delegations: [
            {
              name: 'postgresDelegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
      // Key Vault and Storage are reached over private endpoints rather than
      // their public endpoints. This is not merely a hardening preference:
      // tenant governance policy (MCAPSGov KeyVaultPublicNetworkModify /
      // StorageAccountPublicNetworkModify) forces publicNetworkAccess to
      // Disabled on both resource types shortly after creation, so without
      // private endpoints App Service cannot reach either one and every Key
      // Vault reference resolves to AccessToKeyVaultDenied.
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: '10.20.2.0/24'
        }
      }
    ]
  }
}

resource appServiceSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: appServiceSubnetName
}

resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: postgresSubnetName
}

resource postgresPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
  tags: tags
}

resource postgresPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: postgresPrivateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: vnet
  name: privateEndpointSubnetName
}

resource keyVaultPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: keyVaultPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource keyVaultPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: keyVaultPrivateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

resource blobPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: blobPrivateDnsZoneName
  location: 'global'
  tags: tags
}

resource blobPrivateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: blobPrivateDnsZone
  name: '${vnetName}-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}

output vnetId string = vnet.id
output appServiceSubnetId string = appServiceSubnet.id
output postgresSubnetId string = postgresSubnet.id
output postgresPrivateDnsZoneId string = postgresPrivateDnsZone.id
output privateEndpointSubnetId string = privateEndpointSubnet.id
output keyVaultPrivateDnsZoneId string = keyVaultPrivateDnsZone.id
output blobPrivateDnsZoneId string = blobPrivateDnsZone.id
