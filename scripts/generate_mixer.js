const fs = require('fs');
const {randomBytes} = require("crypto");
const BigNumber = require("bignumber.js");
const MIMCMerkle = require("../dist/lib/MiMCMerkle");

const cls = require("circomlibjs");
function Bits2Num(n, in1) {
    var lc1=0;

    var e2 = 1;
    for (var i = 0; i < n; i++) {
        lc1 += Number(in1[i]) * e2;
        e2 = e2 + e2;
    }
    return lc1
}

async function main() {
  let poseidonHash = await cls.buildPoseidonReference();
  await MIMCMerkle.init();
  // calculate cmt nullifierHash
  const path2_root_pos = [0, 0, 0, 0, 0, 0, 0, 0]
  const path2_root_pos2 = [1, 1, 1, 1, 1, 1, 1, 1]
  const secret = "0";
  const LEAF_NUM = 8;
  //console.log(path2_root_pos.join(""))
  // 255 = 11111111b
  //const cmt_index = parseInt(path2_root_pos.reverse().join(""), 2)
  const cmt_index = Bits2Num(LEAF_NUM, path2_root_pos2)
  //console.log("cmt index", cmt_index)
  const nullifierHash = poseidonHash([cmt_index, secret])
  //console.log("nullifierHash", nullifierHash)

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

  const amount = "100";
  // get merkle root
  let root = poseidonHash([cmt, amount]);

  //let root = MIMCMerkle.rootFromLeafAndPath(leaf, cmt_index, merklePath);

  for (var i = 0; i < 8; i ++) {
    if (path2_root_pos[i] == 1) {
      root = poseidonHash([root, merklePath[i]])
    } else {
      root = poseidonHash([merklePath[i], root])
    }
  }

  const inputs = {
    "root": poseidonHash.F.toString(root),
    "amount": amount, // unit: wei
    "nullifierHash": poseidonHash.F.toString(nullifierHash),
    "secret": secret,
    "paths2_root": merklePath,
    "paths2_root_pos": path2_root_pos
  }

  console.info(inputs)

  fs.writeFileSync(
    "./input.json",
    JSON.stringify(inputs),
    "utf-8"
  );
}

main().then(() => {
  console.log("Done")
})
