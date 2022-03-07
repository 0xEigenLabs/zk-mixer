const cls = require("circomlibjs");
const BN = require("bn.js")

class Mtree {
    cur: number
    leaves2: BigInt[][]
    constructor(rowSize: number, colSize: number) {
        this.leaves2 = []
        for ( var row = 0; row < rowSize; row++ ) {
            this.leaves2[ row ] = [];
            for ( var col = 0; col < colSize; col++ ) {
                this.leaves2[ row ][ col ] = BigInt(0);
            }
        }
        this.cur = 0;
    }
}

let mimcjs
let MT: Mtree
const treeDepth = 8;

export const init = async () => {
  mimcjs = await cls.buildMimc7();
  MT = new Mtree(256, 9);
}

export const insert = (com: BigInt) => {
    MT.leaves2[0][MT.cur] = com;
    updateTree();
    MT.cur ++;
    return MT.cur - 1;
}

const getUniqueLeaf = (leaf, depth) => {
    if (leaf == 0) {
        for (var i = 0; i < depth; i ++) {
            leaf = mimcjs.hash(leaf, leaf)
        }
    }
    return leaf;
}

export const updateTree = () => {
    let currentIndex = MT.cur;
    let leaf1
    let leaf2
    for (var i = 0; i < treeDepth; i ++) {
        let nextIndex = currentIndex / 2;
        if (currentIndex % 2 == 0) {
            leaf1 = MT.leaves2[i][currentIndex];
            leaf2 = getUniqueLeaf(MT.leaves2[i][currentIndex + 1], i);
        } else {
            leaf1 = getUniqueLeaf(MT.leaves2[i][currentIndex - 1], i);
            leaf2 = MT.leaves2[i][currentIndex];
        }
        MT.leaves2[i+1][nextIndex] = mimcjs.hash(leaf1, leaf2);
    }
    return MT.leaves2[treeDepth][0];
}

export const getLeaf = (j, k) => {
    return MT.leaves2[j][k];
}

export const getRoot = (j, k) => {
    return MT.leaves2[treeDepth][0];
}

export const getProof = function(leafIdx, tree, leaves){
  let depth = tree.length;
  let proofIdx = module.exports.proofIdx(leafIdx, depth);
  let proof = new Array(depth);
  proof[0] = leaves[proofIdx[0]]
  for (var i = 1; i < depth; i++){
    proof[i] = tree[depth - i][proofIdx[i]]
  }
  return proof;
}

export const verifyProof = function(leaf, idx, proof, root){
  let computed_root = module.exports.rootFromLeafAndPath(leaf, idx, proof)
  return (root == computed_root)
}

export const rootFromLeafAndPath = function(leaf, idx, merkle_path){
  if (merkle_path.length > 0){
    const depth = merkle_path.length
    const merkle_path_pos = module.exports.idxToBinaryPos(idx, depth)
    let root = leaf;
    for (var i = 0; i < depth; i++) {
        if (merkle_path_pos[i] === 1) {
            root = mimcjs.hash(root, merkle_path[i]);
        } else {
            root = mimcjs.hash(merkle_path[i], root);
        }
    }
    return root;
  } else {
    return leaf
  }
}

// fill a leaf array with zero leaves until it is a power of 2
export const padLeafArray = function(leafArray, zeroLeaf, fillerLength){
  if (Array.isArray(leafArray)){
    var arrayClone = leafArray.slice(0)
    const nearestPowerOfTwo = Math.ceil(module.exports.getBase2Log(leafArray.length))
    const diff = fillerLength || 2**nearestPowerOfTwo - leafArray.length
    for (var i = 0; i < diff; i++){
      arrayClone.push(zeroLeaf)
    }
    return arrayClone
  } else {
    console.log("please enter pubKeys as an array")
  }
}


// fill a leaf hash array with zero leaf hashes until it is a power of 2
export const padLeafHashArray = function(leafHashArray, zeroLeafHash, fillerLength){
  if (Array.isArray(leafHashArray)){
    var arrayClone = leafHashArray.slice(0)
    const nearestPowerOfTwo = Math.ceil(module.exports.getBase2Log(leafHashArray.length))
    const diff = fillerLength || 2**nearestPowerOfTwo - leafHashArray.length
    for (var i = 0; i < diff; i++){
      arrayClone.push(zeroLeafHash)
    }
    return arrayClone
  } else {
    console.log("please enter pubKeys as an array")
  }
}

export const treeFromLeafArray = function(leafArray){
  let depth = module.exports.getBase2Log(leafArray.length);
  let tree = Array(depth);

  tree[depth - 1] = module.exports.pairwiseHash(leafArray)

  for (var j = depth - 2; j >= 0; j--){
    tree[j] = module.exports.pairwiseHash(tree[j+1])
  }

  // return treeRoot[depth-1]
  return tree
}

export const rootFromLeafArray = function(leafArray){
  return module.exports.treeFromLeafArray(leafArray)[0][0]
}

export const pairwiseHash = function(array){
  if (array.length % 2 == 0){
    let arrayHash = []
    for (var i = 0; i < array.length; i = i + 2){
      arrayHash.push(mimcjs.hash(
        array[i].toString(),array[i+1].toString()
      ))
    }
    return arrayHash
  } else {
    console.log('array must have even number of elements')
  }
}

export const generateMerklePosArray = function(depth){
  let merklePosArray = [];
  for (var i = 0;  i < 2**depth; i++){
    let binPos = module.exports.idxToBinaryPos(i, depth)
    merklePosArray.push(binPos)
  }
  return merklePosArray;
}

export const generateMerkleProofArray = function(txTree, txLeafHashes){
  let txProofs = new Array(txLeafHashes.length)
  for (var jj = 0; jj < txLeafHashes.length; jj++){
    txProofs[jj] = module.exports.getProof(jj, txTree, txLeafHashes)
  }
  return txProofs;
}

///////////////////////////////////////////////////////////////////////
// HELPER FUNCTIONS
///////////////////////////////////////////////////////////////////////

export const getBase2Log = function(y){
  return Math.log(y) / Math.log(2);
}

export const binaryPosToIdx = function(binaryPos){
  var idx = 0;
  for (var i = 0; i < binaryPos.length; i++){
    idx = idx + binaryPos[i]*(2**i)
  }
  return idx;
}

export const idxToBinaryPos = function(idx, binLength){

  let binString = idx.toString(2);
  let binPos = Array(binLength).fill(0)
  for (var j = 0; j < binString.length; j++){
    binPos[j] = Number(binString.charAt(binString.length - j - 1));
  }
  return binPos;
}

export const proofIdx = function(leafIdx, treeDepth){
  let proofIdxArray = new Array(treeDepth);
  let proofPos = module.exports.idxToBinaryPos(leafIdx, treeDepth);
  // console.log('proofPos', proofPos)

  if (leafIdx % 2 == 0){
    proofIdxArray[0] = leafIdx + 1;
  } else {
    proofIdxArray[0] = leafIdx - 1;
  }

  for (var i = 1; i < treeDepth; i++){
    if (proofPos[i] == 1){
      proofIdxArray[i] = Math.floor(proofIdxArray[i - 1] / 2) - 1;
    } else {
      proofIdxArray[i] = Math.floor(proofIdxArray[i - 1] / 2) + 1;
    }
  }

  return(proofIdxArray)
}
