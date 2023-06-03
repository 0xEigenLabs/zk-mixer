import { assert } from "chai";
import * as utils from "../src/utils";
const path = require("path");
const test = require("./test");
const cls = require("circomlibjs");
const hre = require("hardhat")

const runTest = async (circuit, poseidonHash, path2RootPos, path2RootPos2) => {
    const LEAF_NUM = 8;
    const cmt_index = utils.Bits2Num(LEAF_NUM, path2RootPos2)
    const nullifierHash = poseidonHash([cmt_index, cmt_index])
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
    let root = nullifierHash;
  
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
      "paths2_root": merklePath,
      "paths2_root_pos": path2RootPos
    }
    console.log("circuitInputs:",circuitInputs)
    await utils.executeCircuit(circuit, circuitInputs)
  }
  
  const runContractTest = async (contract, poseidonHash, path2RootPos) => {
    const cmtIdx = utils.Bits2Num(8, path2RootPos)
    console.log("cmtIdx", cmtIdx);
    const nullifierHash = poseidonHash([cmtIdx, cmtIdx])
  
    console.log("===addCommitment===")
    console.log("root before operation: ", await utils.getRoot(contract))
    await utils.addCommitment(contract, poseidonHash.F.toString(nullifierHash))
    console.log("root after operation: ", await utils.getRoot(contract))
  
    let [a, b, c, publicInfo] = await utils.generateProof(contract, poseidonHash, cmtIdx)
  
    console.log("===verify===", publicInfo)
    await (await contract.verify(
        a, b, c,
        publicInfo
    ))
  }

describe("Bridge test suite", () => {
    let contract
    let poseidonHash
    let poseidonContract
    let circuit
    before(async () => {
        circuit = await test.genMain(path.join(__dirname, "..", "circuit", "merkle_proof_verification.circom"), "Verify", "root", [8]);
        await circuit.loadSymbols();
        const [signer] = await hre.ethers.getSigners();
        console.log("signer", signer.getAddress());
        poseidonHash = await cls.buildPoseidonReference();

        const C6 = new hre.ethers.ContractFactory(
            cls.poseidonContract.generateABI(2),
            cls.poseidonContract.createCode(2),
            signer
          );
        poseidonContract = await C6.deploy();
        console.log("poseidonContract address:", poseidonContract.address)
        let F = await hre.ethers.getContractFactory("Bridge");
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
        await utils.getPoseidon(contract, r, r)
    })

    it("Test Bridge executeCircuit", async () => {
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

    it("Test Bridge Contract", async () => {
        let path2RootPos = [0, 0, 0, 0, 0, 0, 0, 0]
        await runContractTest(contract, poseidonHash, path2RootPos)
    })
})
