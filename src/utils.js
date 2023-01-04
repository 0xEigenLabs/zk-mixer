function arrayChunk(array, chunk_size) {
  return Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size));
}

function buffer2BitArray(b) {
  return [].concat(...Array.from(b.entries()).map(([index, byte]) => byte.toString(2).padStart(8, '0').split('').map(bit => bit == '1' ? 1 : 0)))
}

function bitArray2Buffer(a) {
  return Buffer.from(arrayChunk(a, 8).map(byte => parseInt(byte.join(''), 2)))
}

function bitArray2Decimal(a) {
  var out = 0n;
  var e2 = 1n;
  for (var i = a.length - 1; i >= 0; i--) {
    out += BigInt(a[i]) * e2;
    e2 = e2 + e2;
  }
  return out;
}

function bigIntArray2Bits(arr, intSize = 16) {
  return [].concat(...arr.map(n => n.toString(2).padStart(intSize, '0').split(''))).map(bit => bit == '1' ? 1 : 0);
}

function bigIntArray2Buffer(arr, intSize = 16) {
  return bitArray2Buffer(bigIntArray2Bits(arr, intSize));
}

function getWitnessValue(witness, symbols, varName) {
  return witness[symbols[varName]['varIdx']];
}

function getWitnessMap(witness, symbols, arrName) {
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(arrName)).map(([index, symbol]) => Object.assign({}, symbol, { "name": index, "value": witness[symbol['varIdx']] }));
}

function getWitnessArray(witness, symbols, arrName) {
  return Object.entries(symbols).filter(([index, symbol]) => index.startsWith(`${arrName}[`)).map(([index, symbol]) => witness[symbol['varIdx']]);
}

function getWitnessBuffer(witness, symbols, arrName, varSize = 1) {
  const witnessArray = getWitnessArray(witness, symbols, arrName);
  if (varSize == 1) {
    return bitArray2Buffer(witnessArray);
  } else {
    return bigIntArray2Buffer(witnessArray, varSize);
  }
}

// https://datatracker.ietf.org/doc/html/rfc4634#section-4.1
function padMessage(bits) {
  const L = bits.length;
  const K = (512 + 448 - (L % 512 + 1)) % 512;

  bits = bits.concat([1]);
  if (K > 0) {
    bits = bits.concat(Array(K).fill(0));
  }
  bits = bits.concat(buffer2BitArray(Buffer.from(L.toString(16).padStart(16, '0'), 'hex')))

  return bits;
}

function padMessageToNMsgx(data, nMsg) {
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
function findRange(arr1, arr2, start) {
  var arr1Str = arr1.join("");
  var arr2Str = arr2.join("");
  var startIndex = arr1Str.indexOf(arr2Str, start);
  return [startIndex, startIndex + arr2.length - 1]
}

async function executeCircuit(
  circuit,
  inputs,
) {
  const witness = await circuit.calculateWitness(inputs, true)
  await circuit.checkConstraints(witness)
  await circuit.loadSymbols()
  return witness
}

module.exports = {
  arrayChunk: arrayChunk,
  buffer2BitArray: buffer2BitArray,
  bitArray2Buffer: bitArray2Buffer,
  bitArray2Decimal: bitArray2Decimal,
  bigIntArray2Bits: bigIntArray2Bits,
  bigIntArray2Buffer: bigIntArray2Buffer,
  getWitnessValue: getWitnessValue,
  getWitnessMap: getWitnessMap,
  getWitnessArray: getWitnessArray,
  getWitnessBuffer: getWitnessBuffer,
  padMessage: padMessage,
  padMessageToNMsgx: padMessageToNMsgx,
  findRange: findRange,
  executeCircuit: executeCircuit,
}
