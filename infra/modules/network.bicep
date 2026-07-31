// Virtual network providing genuine network isolation for PostgreSQL Flexible
// Server. App Service gets regional VNet integration (outbound only) so it can
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
var privateDnsZoneName = 'privatelink.postgres.database.azure.com'

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

output vnetId string = vnet.id
output appServiceSubnetId string = appServiceSubnet.id
output postgresSubnetId string = postgresSubnet.id
output postgresPrivateDnsZoneId string = postgresPrivateDnsZone.id
