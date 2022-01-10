import {Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import {PapaERC20} from '../../generated/PapaStakingV1/PapaERC20';
import {sPapaERC20} from '../../generated/PapaStakingV1/sPapaERC20';
import {CirculatingSupply} from '../../generated/PapaStakingV1/CirculatingSupply';
import {ERC20} from '../../generated/PapaStakingV1/ERC20';
import {UniswapV2Pair} from '../../generated/PapaStakingV1/UniswapV2Pair';
import {PapaStaking} from '../../generated/PapaStakingV1/PapaStaking';
import {ethereum} from '@graphprotocol/graph-ts'

import {ProtocolMetric, LastBlock} from '../../generated/schema'
import {
    CIRCULATING_SUPPLY_CONTRACT,
    CIRCULATING_SUPPLY_CONTRACT_BLOCK,
    PAPA_ERC20_CONTRACT,
    SPAPA_ERC20_CONTRACT_V1,
    STAKING_CONTRACT_V1,
    TREASURY_ADDRESS,
    USDT_ERC20_CONTRACT,
    WAVAX_ERC20_CONTRACT,
    TRADERJOE_PAPAMIM_PAIR,
    STAKING_CONTRACT_V2_BLOCK,
    STAKING_CONTRACT_V2,
    SPAPA_ERC20_CONTRACT_V2_BLOCK,
    SPAPA_ERC20_CONTRACT_V2,
    MIM_ERC20_CONTRACT,
    TRADERJOE_PAPAAVAX_PAIR,
    TRADERJOE_PAPAAVAX_PAIR_BLOCK,
} from './Constants';
import {toDecimal} from './Decimals';
import {getPAPAUSDRate, getDiscountedPairUSD, getPairUSD, getAVAXUSDRate} from './Price';


export function loadOrCreateProtocolMetric(blockNumber: BigInt, timestamp: BigInt): ProtocolMetric {
  // Around 4 hours for avalanche network
    let id = blockNumber.minus(blockNumber.mod(BigInt.fromString("10000")));

    let protocolMetric = ProtocolMetric.load(id.toString())
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(id.toString())
        protocolMetric.timestamp = timestamp
        protocolMetric.papaCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.sPapaCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.papaPrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryInvestments = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedPapa = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryMIMRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMIMMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryUsdtRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryUsdtMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryWAVAXRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryWAVAXMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasuryPapaMimPOL = BigDecimal.fromString("0")
        protocolMetric.treasuryPapaAvaxPOL = BigDecimal.fromString("0")
        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal {
    let papa_contract = PapaERC20.bind(Address.fromString(PAPA_ERC20_CONTRACT))
    let total_supply = toDecimal(papa_contract.totalSupply(), 9)
    log.debug("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getCriculatingSupply(blockNumber: BigInt, total_supply: BigDecimal): BigDecimal {
    let circ_supply: BigDecimal
    if (blockNumber.gt(BigInt.fromString(CIRCULATING_SUPPLY_CONTRACT_BLOCK))) {
        let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
        circ_supply = toDecimal(circulatingsupply_contract.PAPACirculatingSupply(), 9)
    } else {
        circ_supply = total_supply;
    }
    log.debug("Circulating Supply {}", [circ_supply.toString()])
    return circ_supply
}

function getSpapaSupply(blockNumber: BigInt): BigDecimal {
    let spapa_contract_v1 = sPapaERC20.bind(Address.fromString(SPAPA_ERC20_CONTRACT_V1))
    let spapac_supply = toDecimal(spapa_contract_v1.circulatingSupply(), 9)

    if (blockNumber.gt(BigInt.fromString(SPAPA_ERC20_CONTRACT_V2_BLOCK))) {
        let spapa_contract_v2 = sPapaERC20.bind(Address.fromString(SPAPA_ERC20_CONTRACT_V2))
        spapac_supply = spapac_supply.plus(toDecimal(spapa_contract_v2.circulatingSupply(), 9))
    }

    log.debug("sPAPA Supply {}", [spapac_supply.toString()])
    return spapac_supply
}

function getPAPAMIMReserves(pair: UniswapV2Pair): BigDecimal[] {
    let reserves = pair.getReserves()
    let mimReserves = toDecimal(reserves.value0, 18)
    let papaReserves = toDecimal(reserves.value1, 9)
    return [papaReserves, mimReserves]
}

function getPAPAAVAXReserves(pair: UniswapV2Pair): BigDecimal[] {
    let reserves = pair.getReserves()
    let papaReserves = toDecimal(reserves.value0, 9)
    let avaxReserves = toDecimal(reserves.value1, 18)
    return [papaReserves, avaxReserves]
}

function getMV_RFV(blockNumber: BigInt): BigDecimal[] {
    let mimERC20 = ERC20.bind(Address.fromString(MIM_ERC20_CONTRACT))
    let usdtERC20 = ERC20.bind(Address.fromString(USDT_ERC20_CONTRACT))
    let wavaxERC20 = ERC20.bind(Address.fromString(WAVAX_ERC20_CONTRACT))

    let papamimPair = UniswapV2Pair.bind(Address.fromString(TRADERJOE_PAPAMIM_PAIR))
    let papaavaxPair = UniswapV2Pair.bind(Address.fromString(TRADERJOE_PAPAAVAX_PAIR))

    let mimBalance = mimERC20.balanceOf(Address.fromString(TREASURY_ADDRESS))
    let usdtBalance = usdtERC20.balanceOf(Address.fromString(TREASURY_ADDRESS))
    let wavaxBalance = wavaxERC20.balanceOf(Address.fromString(TREASURY_ADDRESS))
    let wavaxValue = toDecimal(wavaxBalance, 18).times(getAVAXUSDRate())

    let papausdRate = getPAPAUSDRate()
    let wavaxRate = getAVAXUSDRate()

    //PAPAMIM
    let papamimBalance = papamimPair.balanceOf(Address.fromString(TREASURY_ADDRESS))
    let papamimTotalLP = toDecimal(papamimPair.totalSupply(), 18)
    let papamimReserves = getPAPAMIMReserves(papamimPair)
    let papamimPOL = toDecimal(papamimBalance, 18).div(papamimTotalLP).times(BigDecimal.fromString("100"))
    let papamimValue = getPairUSD(papamimBalance, papamimTotalLP, papamimReserves, papausdRate, BigDecimal.fromString('1'))
    let papamimRFV = getDiscountedPairUSD(papamimBalance, papamimTotalLP, papamimReserves, BigDecimal.fromString('1'))

    //PAPAAVAX
    let papaavaxValue = BigDecimal.fromString('0');
    let papaavaxRFV = BigDecimal.fromString('0')
    let papaavaxPOL = BigDecimal.fromString('0')
    if (blockNumber.gt(BigInt.fromString(TRADERJOE_PAPAAVAX_PAIR_BLOCK))) {
        let papaavaxBalance = papaavaxPair.balanceOf(Address.fromString(TREASURY_ADDRESS))
        let papaavaxTotalLP = toDecimal(papaavaxPair.totalSupply(), 18)
        let papaavaxReserves = getPAPAAVAXReserves(papaavaxPair)
        papaavaxPOL = toDecimal(papaavaxBalance, 18).div(papaavaxTotalLP).times(BigDecimal.fromString("100"))
        papaavaxValue = getPairUSD(papaavaxBalance, papaavaxTotalLP, papaavaxReserves, papausdRate, wavaxRate)
        papaavaxRFV = getDiscountedPairUSD(papaavaxBalance, papaavaxTotalLP, papaavaxReserves, wavaxRate)
    }

    let stableValueDecimal = toDecimal(mimBalance, 18)
        .plus(toDecimal(usdtBalance, 6))

    let lpValue = papamimValue.plus(papaavaxValue)
    let rfvLpValue = papamimRFV.plus(papaavaxRFV)

    let mv = stableValueDecimal.plus(lpValue).plus(wavaxValue)
    let rfv = stableValueDecimal.plus(rfvLpValue)

    log.debug("Treasury Market Value {}", [mv.toString()])
    log.debug("Treasury RFV {}", [rfv.toString()])
    log.debug("Treasury MIM value {}", [toDecimal(mimBalance, 18).toString()])
    log.debug("Treasury USDT value {}", [toDecimal(usdtBalance, 6).toString()])
    log.debug("Treasury WAVAX value {}", [wavaxValue.toString()])
    log.debug("Treasury PAPA-MIM RFV {}", [papamimRFV.toString()])
    log.debug("Treasury PAPA-AVAX RFV {}", [papaavaxRFV.toString()])

    return [
        mv,
        rfv,
        // treasuryMimRiskFreeValue = DAI RFV + DAI
        papamimRFV.plus(toDecimal(mimBalance, 18)),
        // treasuryMimMarketValue = DAI LP + DAI
        papamimValue.plus(toDecimal(mimBalance, 18)),
        //wftmValue
        wavaxValue,
        //usdt
        toDecimal(usdtBalance, 6),
        // treasuryAvaxMarketValue = Avax LP + Avax
        papaavaxValue.plus(toDecimal(wavaxBalance, 18)),
        // treasuryAvaxRiskFreeValue = Avax RFV + Avax
        papaavaxRFV.plus(toDecimal(wavaxBalance, 18)),
        // POL
        papamimPOL,
        papaavaxPOL,
    ]
}

function getNextPAPARebase(blockNumber: BigInt): BigDecimal {
    let staking_contract_v1 = PapaStaking.bind(Address.fromString(STAKING_CONTRACT_V1))
    let distribution_v1 = toDecimal(staking_contract_v1.epoch().value3, 9)
    log.debug("next_distribution v1 {}", [distribution_v1.toString()])
    let next_distribution = distribution_v1

    if (blockNumber.gt(BigInt.fromString(STAKING_CONTRACT_V2_BLOCK))) {
        let staking_contract_v2 = PapaStaking.bind(Address.fromString(STAKING_CONTRACT_V2))
        let distribution_v2 = toDecimal(staking_contract_v2.epoch().value3, 9)
        log.debug("next_distribution v2 {}", [distribution_v2.toString()])
        next_distribution = next_distribution.plus(distribution_v2)
    }

    log.debug("next_distribution total {}", [next_distribution.toString()])

    return next_distribution
}

function getAPY_Rebase(sPAPA: BigDecimal, distributedPAPA: BigDecimal): BigDecimal[] {
    let nextEpochRebase = sPAPA.gt(BigDecimal.fromString('0'))
        ? distributedPAPA.div(sPAPA).times(BigDecimal.fromString("100"))
        : BigDecimal.fromString('0');

    let nextEpochRebase_number = parseFloat(nextEpochRebase.toString())
    let currentAPY = Math.pow(((Math.min(90, nextEpochRebase_number) / 100) + 1), (365 * 3) - 1) * 100

    let currentAPYdecimal = BigDecimal.fromString(currentAPY.toString())

    log.debug("next_rebase {}", [nextEpochRebase.toString()])
    log.debug("current_apy total {}", [currentAPYdecimal.toString()])

    return [currentAPYdecimal, nextEpochRebase]
}

function getRunway(sPapa: BigDecimal, rfv: BigDecimal, rebase: BigDecimal): BigDecimal {
    let runwayCurrent = BigDecimal.fromString("0")

    if (sPapa.gt(BigDecimal.fromString("0")) && rfv.gt(BigDecimal.fromString("0")) && rebase.gt(BigDecimal.fromString("0"))) {
        let treasury_runway = parseFloat(rfv.div(sPapa).toString())

        let nextEpochRebase_number = parseFloat(rebase.toString()) / 100
        let runwayCurrent_num = (Math.log(treasury_runway) / Math.log(1 + nextEpochRebase_number)) / 3;

        runwayCurrent = BigDecimal.fromString(runwayCurrent_num.toString())
    }

    return runwayCurrent
}


export function updateProtocolMetrics(blockNumber: BigInt, timestamp: BigInt): void {
    let pm = loadOrCreateProtocolMetric(blockNumber, timestamp);

    //Total Supply
    pm.totalSupply = getTotalSupply()

    //Circ Supply
    pm.papaCirculatingSupply = getCriculatingSupply(blockNumber, pm.totalSupply)

    //sPapa Supply
    pm.sPapaCirculatingSupply = getSpapaSupply(blockNumber)

    //PAPA Price
    pm.papaPrice = getPAPAUSDRate()

    //PAPA Market Cap
    pm.marketCap = pm.papaCirculatingSupply.times(pm.papaPrice)

    //Total Value Locked
    pm.totalValueLocked = pm.sPapaCirculatingSupply.times(pm.papaPrice)

    //Treasury RFV and MV
    let mv_rfv = getMV_RFV(blockNumber)
    pm.treasuryMarketValue = mv_rfv[0]
    pm.treasuryRiskFreeValue = mv_rfv[1]
    pm.treasuryMIMRiskFreeValue = mv_rfv[2]
    pm.treasuryMIMMarketValue = mv_rfv[3]
    pm.treasuryUsdtRiskFreeValue = mv_rfv[4]
    pm.treasuryUsdtMarketValue = mv_rfv[5]
    pm.treasuryWAVAXRiskFreeValue = mv_rfv[6]
    pm.treasuryWAVAXMarketValue = mv_rfv[7]
    pm.treasuryPapaMimPOL = mv_rfv[8]
    pm.treasuryPapaAvaxPOL = mv_rfv[9]

    // Rebase rewards, APY, rebase
    pm.nextDistributedPapa = getNextPAPARebase(blockNumber)
    let apy_rebase = getAPY_Rebase(pm.sPapaCirculatingSupply, pm.nextDistributedPapa)
    pm.currentAPY = apy_rebase[0]
    pm.nextEpochRebase = apy_rebase[1]

    //Runway
    pm.runwayCurrent = getRunway(pm.sPapaCirculatingSupply, pm.treasuryRiskFreeValue, pm.nextEpochRebase)

    pm.save()
}

export function handleBlock(block: ethereum.Block): void {
    let lastBlock = LastBlock.load('0')
    // Around 5 minutes in avalanche network (1 block per ~1.5 seconds)
    if (lastBlock == null || block.number.minus(lastBlock.number).gt(BigInt.fromString('200'))) {
        lastBlock = new LastBlock('0')
        lastBlock.number = block.number
        lastBlock.timestamp = block.timestamp
        lastBlock.save()
        updateProtocolMetrics(block.number, block.timestamp)
    }
}
