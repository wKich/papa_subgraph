import { RebaseCall } from '../generated/sPapaERC20V2/sPapaERC20'
import { PapaERC20 } from '../generated/sPapaERC20V2/PapaERC20'
import { Rebase } from '../generated/schema'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import {PAPA_ERC20_CONTRACT, STAKING_CONTRACT_V1} from './utils/Constants'
import { toDecimal } from './utils/Decimals'
import {getPAPAUSDRate} from './utils/Price';

export function rebaseFunction(call: RebaseCall): void {
    let rebaseId = call.transaction.hash.toHex()
    var rebase = Rebase.load(rebaseId)
    log.debug("Rebase_V1 event on TX {} with amount {}", [rebaseId, toDecimal(call.inputs.profit_, 9).toString()])

    if (rebase == null && call.inputs.profit_.gt(BigInt.fromI32(0))) {
        let papa_contract = PapaERC20.bind(Address.fromString(PAPA_ERC20_CONTRACT))

        rebase = new Rebase(rebaseId)
        rebase.amount = toDecimal(call.inputs.profit_, 9)
        rebase.stakedPapas = toDecimal(papa_contract.balanceOf(Address.fromString(STAKING_CONTRACT_V1)), 9)
        rebase.contract = STAKING_CONTRACT_V1
        rebase.percentage = rebase.amount.div(rebase.stakedPapas)
        rebase.transaction = rebaseId
        rebase.timestamp = call.block.timestamp
        rebase.value = rebase.amount.times(getPAPAUSDRate())
        rebase.save()
    }
}