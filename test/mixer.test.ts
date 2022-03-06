const { waffle, ethers}  = require("hardhat");
import { ContractFactory, BigNumberish } from "ethers";
import { assert, expect } from "chai";
const BN = require("bn.js");
const fs = require("fs");
const path = require("path");
//const wasm_tester = require("circom_tester").wasm;
const F1Field = require("ffjavascript").F1Field;
const snarkjs = require("snarkjs");
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

function generate_salt(num, length = 512) {
  let ret = []
  for (var i = 0; i < num; i ++) {
    const buf = randomBytes(length/8).toString('hex');
    ret.push(new BN(buf, 16).toString(10))
  }
  return ret
}

function Bits2Num(n, in1) {
    var lc1=0;

    var e2 = 1;
    for (var i = 0; i < n; i++) {
        lc1 += Number(in1[i]) * e2;
        e2 = e2 + e2;
    }
    return lc1
}

function parseProof(proof: any): Proof {
    return {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
    };
}

// deposit
// 0,1,2,3
async function deposit(mixerInstance, signer, cmt){
  var tx = await mixerInstance.deposit(cmt,{
    from: signer,
    value: Amount
  });
  await tx.wait()
  console.log("Deposit done")
}

// getMerkleProof
async function getMerkleProof(mixerInstance, leaf_index) {
  let proof = await mixerInstance.getMerkleProof.call(leaf_index);
  console.info("proof", proof);

  for (let i=0 ;i< proof[0].length;i++){
    let t =  new BN(proof[0][i]);
    console.info("0", t.toString())
  }

  for (let i=0 ;i< proof[1].length;i++){
    let t =  new BN(proof[1][i]);
    console.info("1", t.toString())
  }
  console.log("getMerkleProof done")
}

async function getRoot(mixerInstance) {
  let root =  await mixerInstance.getRoot();
  console.log("root:", root.toString())
  return root.toString()
}

describe("Mixer test suite", () => {
    let contract
    let mimcJS
    let mimcContract
    let signer
    before(async() => {
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
    })

    it ("Test MIMC", async() => {
        const res = await mimcContract["MiMCpe7"](1,2);
        const res2 = mimcJS.hash(1,2);
        assert.equal(res.toString(), mimcJS.F.toString(res2));
    })

    it("Test Mixer Withdraw", async() => {
        // secret
        const path2RootPos = [1, 1, 1, 1, 1, 0, 1, 1]
        const secret = "10111"
        const cmtIdx = Bits2Num(8, path2RootPos)
        const nullifierHash = mimcJS.hash(cmtIdx, secret)
        let cmt = mimcJS.hash(mimcJS.F.toString(nullifierHash), secret)

        console.log("Deposit")
        console.log("root before deposit", await getRoot(contract))
        await deposit(contract, signer, cmt)
        console.log("root after deposit", await getRoot(contract))

        let root = mimcJS.hash(cmt, "0");

        let nums = generate_salt(8, 154)
        for (var i = 0; i < 8; i++) {
            if (path2RootPos[i] === 1) {
                root = mimcJS.hash(root, nums[i])
            } else {
                root = mimcJS.hash(nums[i], root)
            }
        }

        let input = {
            "root": mimcJS.F.toString(root),
            //"root": await getRoot(contract),
            "nullifierHash": mimcJS.F.toString(nullifierHash),
            "secret": secret,
            "paths2_root": nums,
            "paths2_root_pos": path2RootPos
        }
        console.log(input)

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

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const {a, b, c} = parseProof(proof);

        let inputTest = [
            mimcJS.F.toString(root),
            mimcJS.F.toString(nullifierHash)
        ]
        console.log("Withdraw", inputTest)
        await contract.withdraw(
            a, b, c,
            inputTest
        )
    })
})
