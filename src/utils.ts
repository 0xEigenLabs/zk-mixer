import { ethers, BigNumberish } from "ethers";
import { expect } from "chai";
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

export interface Proof {
  a: [BigNumberish, BigNumberish];
  b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
  c: [BigNumberish, BigNumberish];
}

export function parseProof(proof: any): Proof {
  return {
      a: [proof.pi_a[0], proof.pi_a[1]],
      b: [
          [proof.pi_b[0][1], proof.pi_b[0][0]],
          [proof.pi_b[1][1], proof.pi_b[1][0]],
      ],
      c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

export function arrayChunk(array: Array<number>, chunkSize: number): any {
  return Array(Math.ceil(array.length / chunkSize)).map((_, index) => index * chunkSize)
    .map((begin) => array.slice(begin, begin + chunkSize));
}

export function buffer2BitArray(b: Buffer): Array<number> {
  return ([] as number[]).concat(...Array.from(b.entries()).map(([index, byte]) => byte.toString(2).padStart(8, '0').split('').map(bit => bit === '1' ? 1 : 0)));
}

export function bitArray2Buffer(a) {
  return Buffer.from(arrayChunk(a, 8).map(byte => parseInt(byte.join(''), 2)))
}

export function bitArray2Decimal(a: Array<number>): bigint {
  let out = BigInt(0);
  let e2 = BigInt(1);
  for (let i = a.length - 1; i >= 0; i--) {
    out += BigInt(a[i]) * e2;
    e2 = e2 * 2n;
  }
  return out;
}

export function bigIntArray2Bits(arr, intSize = 16) {
  return [].concat(...arr.map(n => n.toString(2).padStart(intSize, '0').split(''))).map(bit => bit === '1' ? 1 : 0);
}

export function bigIntArray2Buffer(arr, intSize = 16) {
  return bitArray2Buffer(bigIntArray2Bits(arr, intSize));
}

export function Bits2Num(n, in1) {
  var lc1 = 0;

  var e2 = 1;
  for (var i = 0; i < n; i++) {
      lc1 += Number(in1[i]) * e2;
      e2 = e2 + e2;
  }
  return lc1
}

export function getWitnessValue(witness, symbols, varName) {
  return witness[symbols[varName]['varIdx']];
}

export function getWitnessMap(witness, symbols, arrName) {
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(arrName)).map(([index, symbol]) => Object.assign({}, symbol, { "name": index, "value": witness[symbol['varIdx']] }));
}

export function getWitnessArray(witness, symbols, arrName) {
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(`${arrName}[`)).map(([index, symbol]) => witness[symbol['varIdx']]);
}

export function getWitnessBuffer(witness, symbols, arrName, varSize = 1) {
  const witnessArray = getWitnessArray(witness, symbols, arrName);
  if (varSize == 1) {
    return bitArray2Buffer(witnessArray);
  } else {
    return bigIntArray2Buffer(witnessArray, varSize);
  }
}

// https://datatracker.ietf.org/doc/html/rfc4634#section-4.1
export function padMessage(bits) {
  const L = bits.length;
  const K = (512 + 448 - (L % 512 + 1)) % 512;

  bits = bits.concat([1]);
  if (K > 0) {
    bits = bits.concat(Array(K).fill(0));
  }
  bits = bits.concat(buffer2BitArray(Buffer.from(L.toString(16).padStart(16, '0'), 'hex')))

  return bits;
}

export function padMessageToNMsgx(data, nMsg) {
  var bits = buffer2BitArray(Buffer.from(data));
  const L = bits.length;
  var K = 0;
  if (L % nMsg != 0) {
    K = (nMsg - (L % nMsg));
    var padBits = Array(K).fill(0);
    bits = padBits.concat(bits);
  }
  
  return { "padEnd": K,
    "bits": bits,
  }
}

// find arr2 in arr1, return the start and end index
// FIXME: find "1" in "[12, 1, 2]" will return the 1 in 12 in this situation
export function findRange(arr1, arr2, start) {
  var arr1Str = arr1.join("");
  var arr2Str = arr2.join("");
  var startIndex = arr1Str.indexOf(arr2Str, start);
  return [startIndex, startIndex + arr2.length - 1]
}

export async function executeCircuit(
  circuit,
  inputs,
) {
  const witness = await circuit.calculateWitness(inputs, true)
  await circuit.checkConstraints(witness)
  await circuit.loadSymbols()
  return witness
}

export async function addCommitment(bridgeInstance, cmt) {
  var tx = await bridgeInstance.addCommitment(cmt);
  await tx.wait()
  console.log("Add commitment done")
}

export async function getPoseidon(bridgeInstance, input, sk) {
  let abi = ["event TestPoseidon(uint256)"]
  var iface = new ethers.utils.Interface(abi)
  let tx = await bridgeInstance.getPoseidon(input, sk)
  let receipt = await tx.wait()
  let logs = iface.parseLog(receipt.events[0]);
  let result = logs.args[0]
}

export async function getMerkleProof(bridgeInstance, leaf_index) {
  let res = []
  let addressBits = []
  let tx = await bridgeInstance.getMerkleProof(leaf_index);
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

export async function getRoot(bridgeInstance) {
  let root = await bridgeInstance.getRoot();
  console.log("root:", root.toString())
  return root.toString()
}

export async function generateProof(contract, poseidonHash, cmtIdx) {
  const nullifierHash = poseidonHash([cmtIdx, cmtIdx])
  let [merklePath, path2RootPos2] = await getMerkleProof(contract, cmtIdx)
  let root = nullifierHash;
  for (var i = 0; i < 8; i++) {
      if (path2RootPos2[i] == 1) {
          root = poseidonHash([root, merklePath[i]])
      } else {
          root = poseidonHash([merklePath[i], root])
      }
      // console.log("Circuit", poseidonHash.F.toString(root), merklePath[i])
  }
  // expect(poseidonHash.F.toString(root)).to.eq(await getRoot(contract));
  // console.log("YES!!!!!!!!!", poseidonHash.F.toString(root), root, await getRoot(contract), cmtIdx);
  let input = {
      "root": poseidonHash.F.toString(root),
      "nullifierHash": poseidonHash.F.toString(nullifierHash),
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
  return [a, b, c, publicSignals]
}

