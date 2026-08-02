// Azure AI Foundry (AI Services) account and the GPT deployment the
// assistant uses to rephrase retrieved Florida statutory passages.
//
// The model is emphatically NOT a source of legal content. Retrieval happens
// in application code against a corpus committed to this repository, and the
// model only receives passages that retrieval already selected. Its output is
// then re-checked for dollar figures and discarded if any appear. If this
// resource is unreachable, misconfigured, or removed, the assistant falls
// back to the deterministic local adapter — so this module is an enhancement
// to phrasing, never a dependency for correctness.
//
// Access is via the web app's managed identity (Cognitive Services OpenAI
// User). No API key is deployed: keys would need storing and rotating, and
// the identity already exists for Key Vault and Blob.
targetScope = 'resourceGroup'

@description('Azure region for the Foundry account.')
param location string

@description('Globally unique name for the AI Services account.')
param accountName string

@description('Name given to the model deployment; becomes AZURE_FOUNDRY_DEPLOYMENT.')
param deploymentName string

@description('Model to deploy.')
param modelName string

@description('Model version.')
param modelVersion string

@description('Tokens-per-minute capacity, in thousands.')
param capacity int

@description('Agent Service model. Separate from the chat model above because the Agent Service always sends top_p, which the gpt-5.5/5.6 reasoning models reject.')
param agentModelName string

@description('Version of the Agent Service model.')
param agentModelVersion string

@description('Capacity, in thousands of TPM, for the Agent Service model.')
param agentCapacity int

@description('Name of the Foundry project that hosts the Agent Service.')
param projectName string

@description('Subnet used for the private endpoint.')
param privateLinkSubnetId string

@description('Object ID of the web app managed identity that will call the model.')
param principalId string

@description('Virtual network the private DNS zone is linked to.')
param virtualNetworkId string

param tags object = {}

@description('Network posture for the Foundry account data plane. Disabled means the private endpoint is the only route in.')
@allowed([
  'Enabled'
  'Disabled'
])
param foundryPublicNetworkAccess string = 'Disabled'

@description('Source IPs allowed to reach the data plane when public access is Enabled. Ignored when defaultAction is Allow.')
param foundryAllowedIpRules array = []

@description('Set to Allow only to let the AI Foundry portal reach the data plane; see README, "Viewing the agent in AI Foundry".')
@allowed([
  'Allow'
  'Deny'
])
param foundryNetworkDefaultAction string = 'Deny'

// The default posture is private: the private endpoint below is the only route
// from App Service, and it is what the running app uses regardless of these
// parameters. They exist because the AI Foundry portal cannot reach a data
// plane behind a private endpoint, and reviewing the agent there is a real
// operational need. Expressing that as parameters keeps the choice in the
// template rather than as a portal edit the next deployment silently reverts.
resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: foundryPublicNetworkAccess
    networkAcls: {
      defaultAction: foundryNetworkDefaultAction
      virtualNetworkRules: []
      ipRules: [for ip in foundryAllowedIpRules: { value: ip }]
    }
    // Entra-only: local API keys are disabled so the managed identity is the
    // sole way in and there is no key to leak or rotate.
    disableLocalAuth: true
    // Required for the Agent Service: agents, threads, and runs are project
    // resources, and projects cannot be created on an account without this.
    allowProjectManagement: true
  }
}

// Agents live on a project, not on the account. Note that the agent itself is
// a data-plane object with no ARM type, so it cannot be declared here; the
// app creates it on first use and reuses it by name.
resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: account
  name: projectName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

// Known ordering hazard: on a *first* deployment ARM sometimes starts this
// child resource while the parent account is still in `Accepted`, and the
// deployment fails with AccountProvisioningStateInvalid. The `parent`
// relationship below is the strongest ordering Bicep can express, so there is
// no template-level fix — re-run the deployment once the account reports
// `Succeeded` and it completes. Subsequent deployments are unaffected.
resource modelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: capacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: modelName
      version: modelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

// Standard, not GlobalStandard: gpt-5.1 is only offered as a regional
// deployment, and it draws on a separate quota pool (OpenAI.Standard.gpt-5.1).
// Sequenced after the chat model because concurrent deployments on one account
// intermittently fail with a conflict.
resource agentModelDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: account
  name: agentModelName
  dependsOn: [modelDeployment]
  sku: {
    name: 'Standard'
    capacity: agentCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: agentModelName
      version: agentModelVersion
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

// Local auth is disabled above, so this assignment is the only way in. It
// lives in this module (rather than the shared role-assignments one) because
// the assignment name must embed the principal ID to survive the web app
// being recreated, and module parameters are the only values ARM resolves
// early enough to appear in a resource name.
var openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource openAiUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, principalId, openAiUserRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
  }
}

// The OpenAI User role above covers chat completions but not the Agent Service
// data plane (agents, threads, runs), which authorizes against Azure AI
// Developer. Note there is no role literally named "Azure AI User".
var aiDeveloperRoleId = '64702f94-c441-49e6-a78b-ef80e0188fee'

resource aiDeveloper 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, principalId, aiDeveloperRoleId)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', aiDeveloperRoleId)
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {  name: 'privatelink.services.ai.azure.com'
  location: 'global'
  tags: tags
}

resource privateDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

// The data plane is also addressed as *.openai.azure.com and
// *.cognitiveservices.azure.com depending on the route the SDK picks, so all
// three zones are linked. Resolving only one of them produces an
// intermittent failure that looks like a transient network fault.
resource openAiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
  tags: tags
}

resource openAiDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openAiDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

resource cognitiveDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.cognitiveservices.azure.com'
  location: 'global'
  tags: tags
}

resource cognitiveDnsZoneLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cognitiveDnsZone
  name: 'link-to-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}

// Creating a project puts the parent account back into `Accepted`, and any
// write that touches the account while it is there fails with
// AccountProvisioningStateInvalid. The private endpoint is such a write, and
// ARM will happily start it in parallel with the project, so the ordering has
// to be stated rather than inferred from the `parent` graph.
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pe-${accountName}'
  dependsOn: [project, agentModelDeployment]
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateLinkSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'foundry'
        properties: {
          privateLinkServiceId: account.id
          groupIds: [
            'account'
          ]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'services-ai'
        properties: {
          privateDnsZoneId: privateDnsZone.id
        }
      }
      {
        name: 'openai'
        properties: {
          privateDnsZoneId: openAiDnsZone.id
        }
      }
      {
        name: 'cognitiveservices'
        properties: {
          privateDnsZoneId: cognitiveDnsZone.id
        }
      }
    ]
  }
}

output accountName string = account.name
output accountId string = account.id
@description('Azure OpenAI data-plane host for this account. The privatelink.openai.azure.com zone above is what makes this name resolve from inside the VNet.')
output endpoint string = 'https://${accountName}.openai.azure.com'
output deploymentName string = modelDeployment.name
output privateDnsZoneGroupId string = privateDnsZoneGroup.id
output projectEndpoint string = 'https://${accountName}.services.ai.azure.com/api/projects/${projectName}'
output agentModelName string = agentModelDeployment.name
