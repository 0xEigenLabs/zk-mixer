pragma circom 2.0.0;
include "./get_merkle_root.circom";
include "../node_modules/circomlib/circuits/mimc.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./merkle_proof_verification.circom";

component main {public [root, nullifierHash]} = Verify(8);