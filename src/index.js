#!/usr/bin/env node

import 'source-map-support/register'
import inquirer from 'inquirer'
import { createLogger, debug, info, } from './utils/log'
import { promptUser } from './questions'
import { INITIAL_MODE } from './questions/questions'
import { createConfigFromAnswers, isBash, isCakeshop, isDocker, isKubernetes, isTessera, } from './model/NetworkConfig'
import {
  createNetwork,
  createQdataDirectory,
  generateResourcesLocally,
  generateResourcesRemote, getFullNetworkPath,
} from './generators/networkCreator'
import { buildBash, initBash } from './generators/bashHelper'
import { createDockerCompose, initDockerCompose } from './generators/dockerHelper'
import { createKubernetes, initKubernetes } from './generators/kubernetesHelper'
import { generateAndCopyExampleScripts } from './generators/examplesHelper'
import { formatTesseraKeysOutput, loadTesseraPublicKey, } from './generators/transactionManager'
import { downloadAndCopyBinaries, pathToQuorumBinary } from './generators/binaryHelper'
import { joinPath, wrapScript } from './utils/pathUtils'
import { executeSync } from './utils/execUtils'
import { buildCakeshopDir } from './generators/cakeshopHelper'
import { cwd, writeFile } from './utils/fileUtils'
import SCRIPTS from './generators/scripts'

const yargs = require('yargs')

const { argv } = yargs
  .boolean('q')
  .alias('q', 'quickstart')
  .describe('q', 'create 3 node raft network with tessera and cakeshop')
  .boolean('v')
  .alias('v', 'verbose')
  .describe('v', 'Turn on additional logs for debugging')
  .help()
  .alias('h', 'help')
  .version()
  .strict()

createLogger(argv.v)
debug('Showing debug logs')

if (argv.q) {
  buildNetwork('quickstart')
} else {
  inquirer.prompt([INITIAL_MODE])
    .then(async ({ mode }) => {
      if (mode === 'exit') {
        info('Exiting...')
        return
      }
      buildNetwork(mode)
    })
}

async function buildNetwork(mode) {
  const answers = await promptUser(mode)
  const config = createConfigFromAnswers(answers)
  if (isBash(config.network.deployment)) {
    await downloadAndCopyBinaries(config)
  }
  await createDirectory(config)
  createScripts(config)
  printInstructions(config)
}

async function createDirectory(config) {
  createNetwork(config)
  if (isBash(config.network.deployment)) {
    await generateResourcesLocally(config)
    createQdataDirectory(config)
    await initBash(config)
  } else if (isDocker(config.network.deployment)) {
    generateResourcesRemote(config)
    createQdataDirectory(config)
    await initDockerCompose(config)
  } else if (isKubernetes(config.network.deployment)) {
    generateResourcesRemote(config)
  } else {
    throw new Error('Only bash, docker, and kubernetes deployments are supported')
  }
}
function createScripts(config) {
  const scripts = [
    SCRIPTS.start,
    SCRIPTS.stop,
    SCRIPTS.runscript,
    SCRIPTS.attach,
    SCRIPTS.publicContract,
  ]
  if (isTessera(config.network.transactionManager)) {
    scripts.push(SCRIPTS.privateContract)
  }
  if (isKubernetes(config.network.deployment)) {
    scripts.push(SCRIPTS.getEndpoints)
  }

  const networkPath = getFullNetworkPath(config)
  scripts.forEach((script) => {
    writeFile(
      joinPath(networkPath, script.filename),
      script.generate(config),
      script.executable
    )
  })
}

function printInstructions(config) {
  info(formatTesseraKeysOutput(config))
  info('')
  info('Quorum network created')
  info('')
  if (isKubernetes(config.network.deployment)) {
    info('Before starting the network please make sure kubectl is installed and setup properly')
    info('Check out our qubernetes project docs for more info: https://github.com/jpmorganchase/qubernetes')
    info('')
  }
  info('Run the following commands to start your network:')
  info('')
  info(`cd network/${config.network.name}`)
  info(`${wrapScript(SCRIPTS.start.filename)}`)
  info('')
  info('A sample simpleStorage contract is provided to deploy to your network')
  info(`To use run ${wrapScript(SCRIPTS.runscript.filename)} ${SCRIPTS.publicContract.filename} from the network folder`)
  info('')
  if (isTessera(config.network.transactionManager)) {
    info(`A private simpleStorage contract was created with privateFor set to use Node 2's public key: ${loadTesseraPublicKey(config, 2)}`)
    info(`To use run ${wrapScript(SCRIPTS.runscript.filename)} ${SCRIPTS.privateContract.filename} from the network folder`)
    info('')
  }
  if (isKubernetes(config.network.deployment)) {
    info('A script to retrieve the quorum rpc and tessera 3rd party endpoints to use with remix or cakeshop is provided')
    info(`To use run ${wrapScript(SCRIPTS.getEndpoints.filename)}  from the network folder`)
    info('')
  }
}
