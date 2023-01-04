const path = require("path");
const { ethers } = require("hardhat");
import test = require("../src/test.js");
import utils = require("../src/utils.js");
const cls = require("circomlibjs");
var Amount = ethers.utils.parseEther('0.02');
console.log(Amount.toString())

function Bits2Num(n, in1) {
  var lc1 = 0;

  var e2 = 1;
  for (var i = 0; i < n; i++) {
      lc1 += Number(in1[i]) * e2;
      e2 = e2 + e2;
  }
  return lc1
}

const runTest = async (circuit, mimcJS, path2RootPos, path2RootPos2) => {
  // secret
  const secret = "0";
  const LEAF_NUM = 8;
  //console.log(path2_root_pos.join(""))
  // 255 = 11111111b
  //const cmt_index = parseInt(path2_root_pos.reverse().join(""), 2)
  const cmt_index = Bits2Num(LEAF_NUM, path2RootPos2)
  //console.log("cmt index", cmt_index)
  const nullifierHash = mimcJS.hash(cmt_index, secret)
  //console.log("nullifierHash", nullifierHash)

  let cmt = mimcJS.hash(nullifierHash, secret)

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
  const amount = "100";
  // get merkle root
  let root = mimcJS.hash(cmt, amount);

  //let root = MIMCMerkle.rootFromLeafAndPath(leaf, cmt_index, merklePath);

  for (var i = 0; i < 8; i ++) {
    if (path2RootPos[i] == 1) {
      root = mimcJS.hash(root, merklePath[i])
    } else {
      root = mimcJS.hash(merklePath[i], root)
    }
  }
  
  const circuitInputs = {
    "root": mimcJS.F.toString(root),
    "amount": amount, // unit: wei
    "nullifierHash": mimcJS.F.toString(nullifierHash),
    "secret": secret,
    "paths2_root": merklePath,
    "paths2_root_pos": path2RootPos
  }

  await utils.executeCircuit(circuit, circuitInputs)
}

describe("Mixer test", function () {
  let circuit
  let mimcJS

  before(async() => {
    circuit = await test.genMain(path.join(__dirname, "..", "circuit", "mixer2.circom"), "Withdraw", "root, nullifierHash, amount", [8]);
    
    await circuit.loadSymbols();

    const [signer] = await ethers.getSigners();
    console.log("signer", signer.address);
    mimcJS = await cls.buildMimc7();
  });


  it("Test Mixer Withdraw", async () => {
    let path2RootPos = [0, 0, 0, 0, 0, 0, 0, 0]
    let path2RootPos2 = [1, 1, 1, 1, 1, 1, 1, 1]
    await runTest(circuit, mimcJS, path2RootPos, path2RootPos2)

    path2RootPos = [1, 0, 0, 0, 0, 0, 0, 0]
    path2RootPos2 = [0, 1, 1, 1, 1, 1, 1, 1]
    await runTest(circuit, mimcJS, path2RootPos, path2RootPos2)

    path2RootPos = [0, 1, 0, 0, 0, 0, 0, 0]
    path2RootPos2 = [1, 0, 1, 1, 1, 1, 1, 1]
    await runTest(circuit, mimcJS, path2RootPos, path2RootPos2)
  });
});
