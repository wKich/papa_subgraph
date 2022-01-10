import { LogRebase, sPapaERC20 } from '../generated/sPapaERC20V2/sPapaERC20'
import { PapaERC20 } from '../generated/sPapaERC20V2/PapaERC20'
import { Rebase } from '../generated/schema'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import {PAPA_ERC20_CONTRACT, SPAPA_ERC20_CONTRACT_V2, STAKING_CONTRACT_V2} from './utils/Constants'
import { toDecimal } from './utils/Decimals'
import {getPAPAUSDRate} from './utils/Price';
import { handleBlock } from './PapaStaking'

export function rebaseFunction(event: LogRebase): void {

    let rebaseId = event.transaction.hash.toHex()
    var rebase = Rebase.load(rebaseId)
    log.debug("Rebase_V2 event on TX {} with percent {}", [rebaseId, toDecimal(event.params.rebase, 9).toString()])

    if (rebase == null && event.params.rebase.gt(BigInt.fromI32(0))) {
        let papa_contract = PapaERC20.bind(Address.fromString(PAPA_ERC20_CONTRACT))
        let spapa_contract = sPapaERC20.bind(Address.fromString(SPAPA_ERC20_CONTRACT_V2))

        // First rebase starts from 3rd epoch
        let last_rebase = spapa_contract.rebases(event.params.epoch.minus(BigInt.fromI32(3)))

        rebase = new Rebase(rebaseId)
        rebase.amount = toDecimal(last_rebase.value4, 9)
        rebase.stakedPapas = toDecimal(papa_contract.balanceOf(Address.fromString(STAKING_CONTRACT_V2)), 9)
        rebase.contract = STAKING_CONTRACT_V2
        rebase.percentage = rebase.amount.div(rebase.stakedPapas)
        rebase.transaction = rebaseId
        rebase.timestamp = event.block.timestamp
        rebase.value = rebase.amount.times(getPAPAUSDRate())
        rebase.save()
    }

    handleBlock(event.block)
}