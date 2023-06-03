pragma circom 2.0.0;
include "./get_merkle_root.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

template Verify(k){
    // public input
    signal input root;
    signal input nullifierHash;
    // private input
    signal input paths2_root[k];
    signal input paths2_root_pos[k];

    // root constrain
    component computed_root = GetMerkleRoot(k);
    computed_root.leaf <== nullifierHash;

    for (var w = 0; w < k; w++){
        computed_root.paths2_root[w] <== paths2_root[w];
        computed_root.paths2_root_pos[w] <== paths2_root_pos[w];
    }
    root === computed_root.out;
}
