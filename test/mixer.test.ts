const { waffle, ethers } = require("hardhat");
import { ContractFactory, BigNumberish } from "ethers";
import { assert, expect } from "chai";
const BN = require("bn.js");
const fs = require("fs");
const path = require("path");
const F1Field = require("ffjavascript").F1Field;
const snarkjs = require("snarkjs");
import { utils } from "ffjavascript";
const { stringifyBigInts, unstringifyBigInts } = utils;
import * as MIMCMerkle from "../lib/MiMCMerkle";
const {
    randomBytes
} = require('crypto');

const provider = waffle.provider

const cls = require("circomlibjs");
const SEED = "mimc";
var Amount = ethers.utils.parseEther('0.01');

interface Proof {
    a: [BigNumberish, BigNumberish];
    b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
    c: [BigNumberish, BigNumberish];
}

function Bits2Num(n, in1) {
    var lc1 = 0;

    var e2 = 1;
    for (var i = 0; i < n; i++) {
        lc1 += Number(in1[i]) * e2;
        e2 = e2 + e2;
    }
    return lc1
}

// deposit
// 0,1,2,3
async function deposit(mixerInstance, signer, cmt) {
    var tx = await mixerInstance.deposit(cmt, {
        from: signer,
        value: Amount
    });
    await tx.wait()
    console.log("Deposit done")
}

async function getMimc(mixerInstance, input, sk) {
    let abi = ["event TestMimc(uint256)"]
    var iface = new ethers.utils.Interface(abi)
    let tx = await mixerInstance.getMimc(input, sk)
    let receipt = await tx.wait()
    let logs = iface.parseLog(receipt.events[0]);
    let result = logs.args[0]
}

// getMerkleProof
async function getMerkleProof(mixerInstance, leaf_index) {
    let res = []
    let addressBits = []
    let tx = await mixerInstance.getMerkleProof(leaf_index);
    let receipt = await tx.wait()

    let abi = ["event MerkleProof(uint256[8] , uint256[8] )"]
    var iface = new ethers.utils.Interface(abi);
    let logs = iface.parseLog(receipt.events[0]);
    let proof = logs.args[0]
    let proof2 = logs.args[1]

    for (let i = 0; i < proof.length; i++) {
        let t = proof[i];
        res.push(t.toString())
    }

    for (let i = 0; i < proof2.length; i++) {
        let t = proof2[i];
        addressBits.push(t.toString())
    }
    return [res, addressBits];
}

async function getRoot(mixerInstance) {
    let root = await mixerInstance.getRoot();
    console.log("root:", root.toString())
    return root.toString()
}

/*
async function getRootEx(mixerInstance, leaf, cmtIdx) {
  let tx =  await mixerInstance.getRootEx(leaf, cmtIdx);
  let receipt = await tx.wait()

  let abi = [ "event RootEx(uint256)" ]
  var iface = new ethers.utils.Interface(abi);
  let logs = iface.parseLog(receipt.events[0]); 
  let root = logs.args[0]

  console.log("root:", root.toString())
  return root.toString()
}
*/

const getUniqueLeaf = (mimc, leaf, depth) => {
    if (leaf == 0) {
        for (let i = 0; i < depth; i++) {
            leaf = mimc.hash(leaf, leaf);
        }
    }
    return leaf;
}


const runTest = async (signer, contract, mimcJS, path2RootPos) => {
    // secret
    const secret = "011"
    const cmtIdx = Bits2Num(8, path2RootPos)
    console.log("cmtIdx", cmtIdx);
    const nullifierHash = mimcJS.hash(cmtIdx, secret)
    let cmt = mimcJS.hash(mimcJS.F.toString(nullifierHash), secret)

    let leaf = mimcJS.hash(cmt, "0");

    console.log("Deposit")
    console.log("root before deposit", await getRoot(contract))
    await deposit(contract, signer, mimcJS.F.toString(leaf))
    console.log("root after deposit", await getRoot(contract))

    let [merklePath, path2RootPos2] = await getMerkleProof(contract, cmtIdx)
    console.log("Path", merklePath, path2RootPos2)
    /* TODO 
       let root = MIMCMerkle.rootFromLeafAndPath(leaf, cmtIdx, merklePath);
       for (let a of root) {
       console.log("Circuit root", mimcJS.F.toString(a))
       }
       let rrr = mimcJS.F.toString(root[root.length - 1])
       console.log("Roots", rrr, await getRoot(contract));
     */

    let root = leaf;
    for (var i = 0; i < 8; i++) {
        if (path2RootPos2[i] == 1) {
            root = mimcJS.hash(root, merklePath[i])
        } else {
            root = mimcJS.hash(merklePath[i], root)
        }
        console.log("Circuit", path2RootPos[i], mimcJS.F.toString(root), merklePath[i])
    }
    //console.log("shit", mimcJS.F.toString(root), await getRootEx(contract, mimcJS.F.toString(leaf), cmtIdx));
    expect(mimcJS.F.toString(root)).to.eq(await getRoot(contract));
    console.log("YES!!!!!!!!!", mimcJS.F.toString(root), root, await getRoot(contract), cmtIdx);

    let input = {
        "root": mimcJS.F.toString(root),
        "nullifierHash": mimcJS.F.toString(nullifierHash),
        "secret": secret,
        "paths2_root": merklePath,
        "paths2_root_pos": path2RootPos2
    }

    let wasm = path.join(__dirname, "../circuit/mixer_js", "mixer.wasm");
    let zkey = path.join(__dirname, "../circuit/mixer_js", "circuit_final.zkey");
    let vkeypath = path.join(__dirname, "../circuit/mixer_js", "verification_key.json");
    const wc = require("../circuit/mixer_js/witness_calculator");
    const buffer = fs.readFileSync(wasm);
    const witnessCalculator = await wc(buffer);

    const witnessBuffer = await witnessCalculator.calculateWTNSBin(
        input,
        0
    );
    const { proof, publicSignals } = await snarkjs.plonk.prove(zkey, witnessBuffer);
    const res = await snarkjs.plonk.exportSolidityCallData(proof, "");
    let result = res.substring(0, res.length - 3);
    console.log(await getRoot(contract));
    let inputTest = [
        //await getRoot(contract),
        mimcJS.F.toString(root),
        mimcJS.F.toString(nullifierHash)
    ]
    console.log("Withdraw 1111", inputTest)
    await contract.withdraw(
        result,
        inputTest
    )
}

describe("Mixer test suite", () => {
    let contract
    let mimcJS
    let mimcContract
    let signer
    before(async () => {
        let signer = provider.getSigner(0)
        mimcJS = await cls.buildMimc7();
        let abi = cls.mimc7Contract.abi
        let createCode = cls.mimc7Contract.createCode
        let f = new ContractFactory(
            abi, createCode(SEED, 91), signer
        )
        mimcContract = await f.deploy()

        console.log(mimcContract.address)
        let F = await ethers.getContractFactory("Mixer");
        contract = await F.deploy(mimcContract.address);

        await MIMCMerkle.init();
    })

    it("Test MIMC", async () => {
        const res = await mimcContract["MiMCpe7"](1, 2);
        const res2 = mimcJS.hash(1, 2);
        assert.equal(res.toString(), mimcJS.F.toString(res2));

        let r = "17476463353520328933908815096303937517517835673952302892565831818490112348179";
        console.log(mimcJS.F.toString(mimcJS.hash(r, r)))
        console.log(mimcJS.F.toString(await mimcContract["MiMCpe7"](r, r)))

        await getMimc(contract, r, r)
    })

    it("Test Mixer Withdraw", async () => {
        // secret
        let path2RootPos = [0, 0, 0, 0, 0, 0, 0, 0]
        await runTest(signer, contract, mimcJS, path2RootPos)

        path2RootPos = [1, 0, 0, 0, 0, 0, 0, 0]
        await runTest(signer, contract, mimcJS, path2RootPos)

        path2RootPos = [0, 1, 0, 0, 0, 0, 0, 0]
        await runTest(signer, contract, mimcJS, path2RootPos)

        // should failed
        //path2RootPos = [0, 0, 1, 0, 0, 0, 0, 0]
        //await runTest(signer, contract, mimcJS, path2RootPos)
    })
})
