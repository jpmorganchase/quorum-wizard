// eslint-disable-next-line import/prefer-default-export
export function createConfig(DDIR, i, ip, serverPortThirdParty, serverPortP2P, peerList) {
  return {
    useWhiteList: false,
    jdbc: {
      username: 'sa',
      password: '',
      url: `jdbc:h2:${DDIR}/db${i};MODE=Oracle;TRACE_LEVEL_SYSTEM_OUT=0`,
      autoCreateTables: true,
    },
    serverConfigs: [
      {
        app: 'ThirdParty',
        serverAddress: `http://${ip}:${serverPortThirdParty}`,
        cors: {
          allowedMethods: ['GET', 'OPTIONS'],
          allowedOrigins: ['*'],
        },
        communicationType: 'REST',
      },
      {
        app: 'Q2T',
        // Tessera uses URI.parse() for this, url encode any spaces in the path
        serverAddress: `unix:${DDIR.replace(/\s/g, '%20')}/tm.ipc`,
        communicationType: 'REST',
      },
      {
        app: 'P2P',
        serverAddress: `http://${ip}:${serverPortP2P}`,
        sslConfig: {
          tls: 'OFF',
          generateKeyStoreIfNotExisted: true,
          serverKeyStore: `${DDIR}/server${i}-keystore`,
          serverKeyStorePassword: 'quorum',
          serverTrustStore: `${DDIR}/server-truststore`,
          serverTrustStorePassword: 'quorum',
          serverTrustMode: 'TOFU',
          knownClientsFile: `${DDIR}/knownClients`,
          clientKeyStore: `${DDIR}/client${i}-keystore`,
          clientKeyStorePassword: 'quorum',
          clientTrustStore: `${DDIR}/client-truststore`,
          clientTrustStorePassword: 'quorum',
          clientTrustMode: 'TOFU',
          knownServersFile: `${DDIR}/knownServers`,
        },
        communicationType: 'REST',
      },
    ],
    peer: peerList,
    keys: {
      passwords: [],
      keyData: [
        {
          privateKeyPath: `${DDIR}/tm.key`,
          publicKeyPath: `${DDIR}/tm.pub`,
        },
      ],
    },
    alwaysSendTo: [],
    features: {
      enablePrivacyEnhancements: true,
    },
  }
}
