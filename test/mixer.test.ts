const { ethers } = require("hardhat");
import { BigNumberish } from "ethers";
import { assert, expect } from "chai";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
import test = require("../src/test.js");
import util = require("../src/utils.js");

const cls = require("circomlibjs");
var Amount = ethers.utils.parseEther('0.02');
console.log(Amount.toString())

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


async function addCommitment(mixerInstance, cmt) {
    var tx = await mixerInstance.addCommitment(cmt);
    await tx.wait()
    console.log("Add commitment done")
}

async function getPoseidon(mixerInstance, input, sk) {
    let abi = ["event TestPoseidon(uint256)"]
    var iface = new ethers.utils.Interface(abi)
    let tx = await mixerInstance.getPoseidon(input, sk)
    let receipt = await tx.wait()
    let logs = iface.parseLog(receipt.events[0]);
    let result = logs.args[0]
}

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

async function generateProof(contract, poseidonHash, cmtIdx, secret) {
    const nullifierHash = poseidonHash([cmtIdx, secret])
    let cmt = poseidonHash([poseidonHash.F.toString(nullifierHash), secret])
    let [merklePath, path2RootPos2] = await getMerkleProof(contract, cmtIdx)
    console.log("Path", merklePath, path2RootPos2)
    let root = cmt;
    for (var i = 0; i < 8; i++) {
        if (path2RootPos2[i] == 1) {
            root = poseidonHash([root, merklePath[i]])
        } else {
            root = poseidonHash([merklePath[i], root])
        }
        console.log("Circuit", poseidonHash.F.toString(root), merklePath[i])
    }
    expect(poseidonHash.F.toString(root)).to.eq(await getRoot(contract));
    console.log("YES!!!!!!!!!", poseidonHash.F.toString(root), root, await getRoot(contract), cmtIdx);

    let input = {
        "root": poseidonHash.F.toString(root),
        "nullifierHash": poseidonHash.F.toString(nullifierHash),
        "secret": secret,
        "paths2_root": merklePath,
        "paths2_root_pos": path2RootPos2
    }

    let wasm = path.join(__dirname, "../circuit/main_js", "main.wasm");
    let zkey = path.join(__dirname, "../circuit", "circuit_final.zkey");
    const wc = require("../circuit/main_js/witness_calculator");
    const buffer = fs.readFileSync(wasm);
    const witnessCalculator = await wc(buffer);

    const witnessBuffer = await witnessCalculator.calculateWTNSBin(
        input,
        0
    );
    const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
    const { a, b, c } = parseProof(proof);
    console.log(await getRoot(contract));
    const inputTest = [
        poseidonHash.F.toString(root),
        poseidonHash.F.toString(nullifierHash)
    ]
    return [a, b, c, inputTest]
}

const runTest = async (circuit, poseidonHash, path2RootPos, path2RootPos2) => {
    const secret = "0";
    const LEAF_NUM = 8;
    const cmt_index = Bits2Num(LEAF_NUM, path2RootPos2)
    const nullifierHash = poseidonHash([cmt_index, secret]) 
    let cmt = poseidonHash([nullifierHash, secret])
    // generates salt to encrypt each leaf
    let merklePath = [
      '0',
      '11730251359286723731141466095709901450170369094578288842486979042586033922425',
      '9246143820134657901174176070515121907817622693387763521229610032056676659170',
      '3919701857960328675810908960351443394156342162925591865624975500788003961839',
      '11868459870544964516983456008242250460119356993157504951373700810334626455267',
      '17452340833314273101389791943519612073692685328163719737408744891984034913325',
      '5253775198292439148470029927208469781432760606734473405438165226265735347735',
      '9586203148669237657308746417333646936338855598595657703565568663564319347700'
    ]
    // get merkle root
    let root = cmt;

    for (var i = 0; i < 8; i ++) {
      if (path2RootPos[i] == 1) {
        root = poseidonHash([root, merklePath[i]])
      } else {
        root = poseidonHash([merklePath[i], root])
      }
    }

    const circuitInputs = {
      "root": poseidonHash.F.toString(root),
      "nullifierHash": poseidonHash.F.toString(nullifierHash),
      "secret": secret,
      "paths2_root": merklePath,
      "paths2_root_pos": path2RootPos
    }
    console.log("circuitInputs:",circuitInputs)
    await util.executeCircuit(circuit, circuitInputs)
  }

const runForwardTest = async (contract, poseidonHash, path2RootPos) => {
    const secret = "011"
    const cmtIdx = Bits2Num(8, path2RootPos)
    console.log("cmtIdx", cmtIdx);
    const nullifierHash = poseidonHash([cmtIdx, secret])
    let cmt = poseidonHash([poseidonHash.F.toString(nullifierHash), secret])

    console.log("===addCommitment===")
    console.log("root before operation: ", await getRoot(contract))
    await addCommitment(contract, poseidonHash.F.toString(cmt))
    console.log("root after operation: ", await getRoot(contract))

    let [a, b, c, publicInfo] = await generateProof(contract, poseidonHash, cmtIdx, secret)

    console.log("===verify===", publicInfo)
    await (await contract.verify(
        a, b, c,
        publicInfo
    )).wait()
}

describe("Mixer test suite", () => {
    let contract
    let poseidonHash
    let poseidonContract
    let circuit
    before(async () => {
        circuit = await test.genMain(path.join(__dirname, "..", "circuit", "mixer.circom"), "Verify", "root, nullifierHash", [8]);
        await circuit.loadSymbols();

        const [signer] = await ethers.getSigners();
        console.log("signer", signer.address);
        poseidonHash = await cls.buildPoseidonReference();

        const C6 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(2),
            cls.poseidonContract.createCode(2),
            signer
          );
        poseidonContract = await C6.deploy();
        console.log("poseidonContract address:", poseidonContract.address)
        let F = await ethers.getContractFactory("Mixer");
        contract = await F.deploy(poseidonContract.address);
        await contract.deployed()
        console.log("contract address:", contract.address)
    })

    it("Test Poseidon", async () => {
        const res = await poseidonContract["poseidon(uint256[2])"]([1, 2]);
        const res2 = poseidonHash([1, 2]);
        assert.equal(res.toString(), poseidonHash.F.toString(res2));

        let r = "17476463353520328933908815096303937517517835673952302892565831818490112348179";
        console.log(poseidonHash.F.toString(poseidonHash([r, r])))
        console.log(poseidonHash.F.toString(await poseidonContract["poseidon(uint256[2])"]([r, r])))
        await getPoseidon(contract, r, r)
    })

    it("Test Mixer executeCircuit", async () => {
        let path2RootPos = [0, 0, 0, 0, 0, 0, 0, 0]
        let path2RootPos2 = [1, 1, 1, 1, 1, 1, 1, 1]
        await runTest(circuit, poseidonHash, path2RootPos, path2RootPos2)
    
        path2RootPos = [1, 0, 0, 0, 0, 0, 0, 0]
        path2RootPos2 = [0, 1, 1, 1, 1, 1, 1, 1]
        await runTest(circuit, poseidonHash, path2RootPos, path2RootPos2)
    
        path2RootPos = [0, 1, 0, 0, 0, 0, 0, 0]
        path2RootPos2 = [1, 0, 1, 1, 1, 1, 1, 1]
        await runTest(circuit, poseidonHash, path2RootPos, path2RootPos2)
      });

    it("Test Mixer Forward", async () => {
        let path2RootPos = [0, 0, 0, 0, 0, 0, 0, 0]
        await runForwardTest(contract, poseidonHash, path2RootPos)
    })
})
