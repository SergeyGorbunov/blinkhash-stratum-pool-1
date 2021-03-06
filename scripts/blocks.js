/*
 *
 * Blocks (Updated)
 *
 */

// Import Required Modules
var bignum = require('bignum');
var util = require('./util.js');

// Import Required Modules
var Merkle = require('./merkle.js');
var Transactions = require('./transactions.js');

// BlockTemplate Main Function
var BlockTemplate = function(jobId, rpcData, poolAddressScript, extraNoncePlaceholder, txMessages, recipients, network) {

    // Function to get Merkle Hashes
    function getMerkleHashes(steps) {
        return steps.map(function(step) {
            return step.toString('hex');
        });
    }

    // Function to get Transaction Buffers
    function getTransactionBuffers(txs) {
        var txHashes = txs.map(function(tx) {
            if (tx.txid !== undefined) {
                return util.uint256BufferFromHash(tx.txid);
            }
            return util.uint256BufferFromHash(tx.hash);
        });
        return [null].concat(txHashes);
    }

    // Function to get Masternode Votes
    function getVoteData() {
        if (!rpcData.masternode_payments) return Buffer.from([]);
        return Buffer.concat(
            [util.varIntBuffer(rpcData.votes.length)].concat(
                rpcData.votes.map(function(vt) {
                    return Buffer.from(vt, 'hex');
                })
            )
        );
    }

    // Establish Block Variables
    this.rpcData = rpcData;
    this.jobId = jobId;
    this.target = rpcData.target ? bignum(rpcData.target, 16) : util.bignumFromBitsHex(rpcData.bits);
    this.difficulty = parseFloat((diff1 / this.target.toNumber()).toFixed(9));
    this.prevHashReversed = util.reverseByteOrder(Buffer.from(rpcData.previousblockhash, 'hex')).toString('hex');
    this.transactionData = Buffer.concat(rpcData.transactions.map(function(tx) {
        return Buffer.from(tx.data, 'hex');
    }));

    // Establish Merkle Variables
    this.merkleTree = new Merkle(getTransactionBuffers(rpcData.transactions));
    this.merkleBranch = getMerkleHashes(this.merkleTree.steps);

    // Structure New Block Transaction
    this.generation = new Transactions(
        rpcData,
        poolAddressScript,
        extraNoncePlaceholder,
        txMessages,
        recipients,
        network
    );

    // Serialize Block Coinbase
    this.serializeCoinbase = function(extraNonce1, extraNonce2) {
        return Buffer.concat([
            this.generation[0],
            extraNonce1,
            extraNonce2,
            this.generation[1]
        ]);
    };

    // Serialize Block Headers
    this.serializeHeader = function(merkleRoot, nTime, nonce) {
        var header =  Buffer.alloc(80);
        var position = 0;
        header.write(nonce, position, 4, 'hex');
        header.write(rpcData.bits, position += 4, 4, 'hex');
        header.write(nTime, position += 4, 4, 'hex');
        header.write(merkleRoot, position += 4, 32, 'hex');
        header.write(rpcData.previousblockhash, position += 32, 32, 'hex');
        header.writeUInt32BE(rpcData.version, position + 32);
        var header = util.reverseBuffer(header);
        return header;
    };

    // Serialize Entire Block
    this.serializeBlock = function(header, coinbase) {
        return Buffer.concat([
            header,
            util.varIntBuffer(this.rpcData.transactions.length + 1),
            coinbase,
            this.transactionData,
            getVoteData(),
            Buffer.from([])
        ]);
    };

    // Push Submissions to Array
    var submits = [];
    this.registerSubmit = function(extraNonce1, extraNonce2, nTime, nonce) {
        var submission = extraNonce1 + extraNonce2 + nTime + nonce;
        if (submits.indexOf(submission) === -1) {
            submits.push(submission);
            return true;
        }
        return false;
    };

    // Get Current Job Parameters
    this.getJobParams = function() {
        if (!this.jobParams) {
            this.jobParams = [
                this.jobId,
                this.prevHashReversed,
                this.generation[0].toString('hex'),
                this.generation[1].toString('hex'),
                this.merkleBranch,
                util.packInt32BE(this.rpcData.version).toString('hex'),
                this.rpcData.bits,
                util.packUInt32BE(this.rpcData.curtime).toString('hex'),
                true
            ];
        }
        return this.jobParams;
    };
};

// Export BlockTemplate
module.exports = BlockTemplate;
