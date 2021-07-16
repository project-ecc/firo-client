<template>
    <div id="send-page">
        <div id="send-primary">
            <input
                v-model="filter"
                type="text"
                placeholder="Search by label or address"
            />

            <AnimatedTable
                ref="table"
                :fields="tableFields"
                :data="filteredSendAddresses"
                :track-by="'address'"
                :on-row-select="navigateToAddressBookItem"
                :compare-elements="(a, b) => a.address === b.address && a.label === b.label"
                no-data-message="No Saved Addresses"
            />
        </div>

        <section class="send-detail">
            <div class="inner" :class="{disabled: formDisabled, unsynced: !isBlockchainSynced}">
                <div id="top" class="not-footer">
                    <div class="field" id="label-field">
                        <InputFrame label="Label">
                            <input
                                id="label"
                                ref="label"
                                v-model.trim="label"
                                v-focus
                                type="text"
                                name="label"
                                tabindex="1"
                                placeholder="Label"
                                :disabled="formDisabled"
                            />
                        </InputFrame>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script>
import lodash from 'lodash';
import { mapGetters } from 'vuex';
import SendFlow from "renderer/components/SendPage/SendFlow";
import {isValidAddress} from 'lib/isValidAddress';
import {convertToSatoshi, convertToCoin} from 'lib/convert';
import Amount from "renderer/components/shared/Amount";
import {FirodErrorResponse} from "daemon/firod";
import InputSelection from "renderer/components/SendPage/InputSelection";
import Popup from "renderer/components/shared/Popup";
import AnimatedTable from "renderer/components/AnimatedTable/AnimatedTable";
import AddressBookItemEditableLabel from "renderer/components/AnimatedTable/AddressBookItemEditableLabel";
import AddressBookItemAddress from "renderer/components/AnimatedTable/AddressBookItemAddress";
import PrivatePublicBalance from "renderer/components/shared/PrivatePublicBalance";
import InputFrame from "renderer/components/shared/InputFrame";

export default {
    name: 'SendPage',

    components: {
        PrivatePublicBalance,
        AnimatedTable,
        SendFlow,
        Amount,
        InputSelection,
        Popup,
        InputFrame
    },

    inject: [
        '$validator'
    ],

    data () {
        return {
            label: this.$route.query.label || '',
            amount: this.$route.query.amount || '',
            address: this.$route.query.address || '',
            subtractFeeFromAmount: false,
            useCustomFee: false,
            // In certain cases, firod might suggest very low fees. Practically, we probably never want this.
            userTxFeePerKb: '',
            isPrivate: true,
            showCustomInputSelector: false,
            useCustomInputs: false,
            customInputs: [],
            tableFields: [
                {name: AddressBookItemEditableLabel, width: "160pt"},
                {name: AddressBookItemAddress}
            ],
            feeMap: {},
            // This is the search term to filter addresses by.
            filter: ''
        }
    },

    computed: {
        ...mapGetters({
            network: 'ApiStatus/network',
            isLelantusAllowed: 'ApiStatus/isLelantusAllowed',
            isBlockchainSynced: 'Blockchain/isBlockchainSynced',
            availablePrivate: 'Balance/available',
            availablePublic: 'Balance/availablePublic',
            sendAddresses: 'AddressBook/sendAddresses',
            addressBook: 'AddressBook/addressBook',
            smartFeePerKb: 'ApiStatus/smartFeePerKb'
        }),

        transactionFeeAndError() {
            return this.feeMap[this.currentTxFeeId];
        },

        currentTxFeeId() {
            if (!this.satoshiAmount) return;
            if (this.useCustomFee && this.getValidationTooltip('txFeePerKb').content) return;
            if (this.getValidationTooltip('amount').content) return;

            return [
                this.satoshiAmount,
                this.txFeePerKb,
                this.coinControl,
                this.subtractFeeFromAmount,
                this.isPrivate
            ]
                .map(String)
                .join("\n");
        },

        formDisabled() {
            return !this.isBlockchainSynced || (this.isPrivate && !this.isLelantusAllowed);
        },

        transactionFee() {
            return this.transactionFeeAndError && this.transactionFeeAndError[0];
        },

        transactionFeeError() {
            return this.transactionFeeAndError && this.transactionFeeAndError[1];
        },

        txFeePerKb() {
            return Number(this.userTxFeePerKb) || this.smartFeePerKb;
        },

        filteredSendAddresses () {
            // filter must be outside the closure for reactivity to work.
            const filter = this.filter;
            return this.sendAddresses.filter(address => address.label.includes(filter) || address.address.includes(filter));
        },

        showAddToAddressBook () {
            return isValidAddress(this.address, this.network) && !this.addressBook[this.address];
        },

        coinControl () {
            return this.customInputs.length ? this.customInputs.map(tx => [tx.txid, tx.txIndex]) : undefined;
        },

        coinControlSelectedAmount () {
            return this.customInputs.reduce((a, tx) => a + tx.amount, 0);
        },

        available () {
            return this.isPrivate ? this.availablePrivate : this.availablePublic;
        },

        // This is the amount the user entered in satoshis.
        satoshiAmount () {
            return convertToSatoshi(this.amount);
        },

        // This is the amount the user will receive. It may be less than satoshiAmount.
        amountToReceive () {
            return this.subtractFeeFromAmount ? this.satoshiAmount - this.transactionFee : this.satoshiAmount;
        },

        // This is the total amount that will be sent, including transaction fee.
        totalAmount () {
            return this.subtractFeeFromAmount ? this.satoshiAmount : this.satoshiAmount + this.transactionFee;
        },

        // We can begin the send if the fee has been shown and the form is valid.
        canBeginSend () {
            return this.isValidated && this.transactionFee > 0 && !this.totalAmountExceedsBalance;
        },

        isValidated () {
            // this.errors was already calculated when amount and address were entered.
            return !!(this.amount && this.address && this.transactionFee && !this.validationErrors.items.length);
        },

        amountValidations () {
            if (this.isPrivate) {
                return 'amountIsWithinAvailableBalance|amountIsValid|privateAmountDoesntViolateSpendLimit';
            } else {
                return 'amountIsWithinAvailableBalance|amountIsValid';
            }
        },

        getValidationTooltip () {
            return (fieldName) => ({
                content: this.validationErrors.first(fieldName),
                trigger: 'manual',
                boundariesElement: 'body',
                offset: 8,
                placement: 'left',
                classes: 'error',
                show: true
            })
        }
    },

    watch: {
        $route(to) {
            this.address = to.query.address || '';
            this.label = to.query.label || '';
            this.amount = to.query.amount || '';
        },


        // Returns [number (txfee in satoshi), error (string)], one of which will be null.
        async currentTxFeeId() {
            if (!this.currentTxFeeId) return;
            if (this.feeMap[this.currentTxFeeId]) return;

            // Only calculate the fee once the user has stopped typing for 300ms.
            const txFeeId = this.currentTxFeeId;
            await new Promise(r => setTimeout(r, 300));
            if (this.currentTxFeeId !== txFeeId) return;

            let fee;
            try {
                if (this.isPrivate) {
                    fee = [await $daemon.calcLelantusTxFee(this.satoshiAmount, this.txFeePerKb, this.subtractFeeFromAmount, this.coinControl), null];
                } else {
                    fee = [await $daemon.calcPublicTxFee(this.satoshiAmount, this.subtractFeeFromAmount, this.txFeePerKb, this.coinControl), null];
                }

                if (!this.subtractFeeFromAmount && this.satoshiAmount + fee[0] > (this.coinControl ? this.coinControlSelectedAmount : this.available)) {
                    fee = [null, 'Insufficient funds'];
                }
            } catch (e) {
                if (e instanceof FirodErrorResponse) {
                    fee = [null, e.errorMessage];
                } else {
                    fee = [null, `${e}`];
                }
            }

            this.$set(this.feeMap, txFeeId, fee);
        },

        useCustomFee() {
            if (!this.useCustomFee) {
                // Make sure the validation warning goes away.
                this.userTxFeePerKb = '';
            }
        },

        subtractFeeFromAmount() {
            this.$validator.validate('amount');
        },

        useCustomInputs() {
            if (this.useCustomInputs) {
                this.showCustomInputSelector = true;
            } else {
                this.customInputs = [];
            }

            this.$validator.validateAll();
        },

        coinControlSelectedAmount() {
            this.$validator.validateAll();
        },

        isPrivate() {
            this.cleanupForm(false);
        }
    },

    beforeMount () {
        // Set up VeeValidator rules.

        this.$validator.extend('firoAddress', {
            getMessage: () => 'The Firo address you entered is invalid',
            validate: (value) => isValidAddress(value, this.network)
        });

        this.$validator.extend('amountIsWithinAvailableBalance', {
            // this.availableXzc will still be reactively updated.
            getMessage: () => this.useCustomInputs ?
                `Amount is over the sum of your selected coins, ${convertToCoin(this.coinControlSelectedAmount)} FIRO`
                :
                `Amount is over your available balance of ${convertToCoin(this.available)} FIRO`,

            validate: (value) => this.useCustomInputs ?
                convertToSatoshi(value) <= this.coinControlSelectedAmount
                :
                convertToSatoshi(value) <= this.available
        });

        this.$validator.extend('amountIsValid', {
            getMessage: () => 'Amount must be a multiple of 0.00000001',
            // We use a regex here so as to not to have to deal with floating point issues.
            validate: (value) => Number(value) !== 0 && !!value.match(/^\d+(\.\d{1,8})?$/)
        });

        this.$validator.extend('privateAmountDoesntViolateSpendLimit', {
            getMessage: () =>
                `Due to private transaction spend limits, you may not spend more than 5001 FIRO (including fees) in one transaction`,

            validate: (value) => this.subtractFeeFromAmount ? convertToSatoshi(value) <= 5001e8 : convertToSatoshi(value) <= 5000.99e8
        });

        this.$validator.extend('txFeeIsValid', {
            getMessage: () => 'Transaction fee must be an integer between 1 and 1,000,000',
            validate: (value) => value > 0 && value <= 1_000_000 && (value % 1 === 0)
        })
    },

    methods: {
        convertToCoin,

        async addToAddressBook() {
            if (!this.showAddToAddressBook) return;
            if (this.formDisabled) return;
            if (this.addressBook[this.address]) return;

            const item = {
                address: this.address,
                label: this.label,
                purpose: 'send'
            };
            $store.commit('AddressBook/updateAddress', item);
            await $daemon.addAddressBookItem(item);
        },

        navigateToAddressBookItem(addressBookItem) {
            this.address = addressBookItem.address;
            this.label = addressBookItem.label;
        },

        cleanupForm(enablePrivate=true) {
            if (enablePrivate) this.isPrivate = true;
            this.useCustomInputs = false;
            this.label = '';
            this.amount = '';
            this.address = '';
        }
    }
}
</script>

<style lang="scss">
@import "src/renderer/styles/colors";
@import "src/renderer/styles/inputs";
@import "src/renderer/styles/sizes";
@import "src/renderer/styles/typography";

#send-page {
    height: 100%;

    #send-primary {
        height: 100%;
        width: $size-primary-content-width;
        float: left;
        display: flex;
        flex-direction: column;

        padding: $size-main-margin;

        input[type="text"] {
            @include search-input();
            margin-bottom: $size-medium-space;
        }

        .animated-table {
            flex-grow: 1;
        }
    }

    .send-detail {
        width: $size-secondary-content-width;
        float: right;
        box-sizing: border-box;
        padding: $size-detail-margin;
        height: 100%;
        background-color: var(--color-detail-background);

        .input-with-tip-container {
            width: fit-content;
            position: relative;

            .tip {
                position: absolute;
                bottom: $size-input-vertical-padding;
                right: $size-input-horizontal-padding;
            }
        }

        .inner {
            height: 100%;
            display: flex;
            flex-flow: column;

            @at-root .disabled .not-footer {
                opacity: $disabled-input-opacity;
            }

            #top {
                flex-grow: 1;

                .framed-input {
                    width: 100%;
                }
            }

            #bottom {
                #totals {
                    .total-field {
                        margin-bottom: $size-small-space;

                        label, .value {
                            display: inline;
                        }

                        label {
                            margin-right: $size-medium-space;
                        }

                        .value {
                            float: right;
                        }
                    }
                }

                .error {
                    @include error();
                    margin-bottom: $size-small-space;
                }
            }
        }
    }
}
</style>
