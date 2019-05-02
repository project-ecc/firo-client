import * as types from '~/types/Balance'

import { createLogger } from '#/lib/logger'

const logger = createLogger('zcoin:store:balance')

const state = {
    total: {
        all: 0,
        pending: 0,
        available: 0
    },
    xzc: {
        confirmed: 0,
        unconfirmed: 0,
        locked: 0
    },
    zerocoin: {
        confirmed: 0,
        unconfirmed: 0
    }
}

const mutations = {
    [types.UPDATE_BALANCE] (state, balance) {
        logger.debug('going to update balance %O', balance)

        const { total, xzc, zerocoin } = balance

        const { all, pending, available } = total
        const { confirmed: confirmedXzc, unconfirmed: unconfirmedXzc, locked } = xzc
        const { confirmed: confirmedZerocoin, unconfirmed: unconfirmedZerocoin } = zerocoin

        state.total = {
            ...state.total,
            all,
            pending,
            available
        }

        state.xzc = {
            ...state.xzc,
            confirmed: confirmedXzc,
            unconfirmed: unconfirmedXzc,
            locked
        }

        state.zerocoin = {
            ...state.zerocoin,
            confirmed: confirmedZerocoin,
            unconfirmed: unconfirmedZerocoin
        }
    }
}

const actions = {
    [types.SET_INITIAL_STATE] ({ dispatch, commit, state }, initialState) {
        dispatch(types.UPDATE_BALANCE, initialState)
    },

    [types.ON_BALANCE_SUBSCRIPTION] ({ dispatch }, balance) {
        dispatch(types.UPDATE_BALANCE, balance)
    },

    [types.UPDATE_BALANCE] ({ commit }, balance) {
        const { total, xzc, zerocoin } = balance

        commit(types.UPDATE_BALANCE, {
            total,
            xzc,
            zerocoin
        })
    }
}

const getters = {
    total: (state) => state.total.all,
    immatureXzc: (state, getters, rootState, rootGetters) => {
        const txs = rootGetters['Address/walletAddresses'].reduce((a, addr) => [...a, ...addr.transactions], [])

        // Mined transactions take 100 blocks to mature.
        const maxHeight = rootGetters['Blockchain/currentBlockHeight'] - 100
        const immatureTxs = txs.filter((tx) => tx.category === 'mined' && tx.block.height > maxHeight)

        return immatureTxs.reduce((a, tx) => a + tx.amount, 0)
    },
    availableXzc: (state) => state.xzc.confirmed - state.xzc.locked,
    availableZerocoin: (state) => state.zerocoin.confirmed,
    unconfirmedXzc: (state) => state.xzc.unconfirmed,

    confirmedZerocoin: (state, getters, rootState, rootGetters) =>
        rootGetters['Mint/confirmedMints'].reduce((a,tx) => a+tx.amount, 0),
    unconfirmedZerocoin: (state, getters, rootState, rootGetters) =>
        rootGetters['Mint/unconfirmedMints'].reduce((a,tx) => a+tx.amount, 0),

    confirmedXzcZerocoinRatio: (state, getters) => getters.confirmedZerocoin / getters.total
}

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}
