pragma circom 2.0.0;
include "./get_merkle_root.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template Verify(k){
    // public input
    signal input root;
    signal input nullifierHash;

    // private input
    signal input secret;
    signal input paths2_root[k];
    signal input paths2_root_pos[k];

    // root constrain
    component leaf = Poseidon(2);
    leaf.inputs[0] <== nullifierHash;
    leaf.inputs[1] <== secret;

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

    component nullifier = Poseidon(2);
    nullifier.inputs[0] <== cmt_index.out;
    nullifier.inputs[1] <== secret;

    nullifierHash === nullifier.out;
}
