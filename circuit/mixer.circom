pragma circom 2.0.0;
include "./get_merkle_root.circom";
include "../node_modules/circomlib/circuits/mimc.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template Withdraw(k){
    // public input
    signal input root;
    signal input nullifierHash;
    signal input amount;

    // private input
    signal input secret;
    signal input paths2_root[k];
    signal input paths2_root_pos[k];

    // construct cmt
    component cmt = MiMC7(91);
    cmt.x_in <== nullifierHash;
    cmt.k <== secret;

    // root constrain
    component leaf = MiMC7(91);
    leaf.x_in <== cmt.out;
    leaf.k <== amount;

    component computed_root = GetMerkleRoot(k);
    computed_root.leaf <== leaf.out;

    for (var w = 0; w < k; w++){
        computed_root.paths2_root[w] <== paths2_root[w];
        computed_root.paths2_root_pos[w] <== paths2_root_pos[w];
    }
    root === computed_root.out;

    // nullifier constrain
    component cmt_index = Bits2Num(k);
    for (var i = 0 ;i < k ; i++){
        cmt_index.in[i] <== 1 - paths2_root_pos[i];
    }

    component nullifier = MiMC7(91);
    nullifier.x_in <== cmt_index.out;
    nullifier.k <== secret;

    nullifierHash === nullifier.out;
}

component main {public [root, nullifierHash, amount]} = Withdraw(8);
