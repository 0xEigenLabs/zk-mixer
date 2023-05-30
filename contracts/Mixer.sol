// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "./MerkleTree.sol";
import "./verifier.sol";

contract Mixer is MerkleTree ,Verifier {
    mapping (uint256 => bool) public roots;
    mapping(uint256 => bool) public nullifierHashes;
    mapping(uint256 => bool) public commitments;

    event CommitmentAdded(uint256 indexed commitment, uint256 leafIndex, uint256 timestamp);
    event VerificationMade(uint256 nullifierHash);

    constructor  (address _mimc) MerkleTree(_mimc) public {}

    function addCommitment(uint256 _commitment) public{
        require(!commitments[_commitment], "The commitment has been submitted");
        uint256 insertedIndex = insert(_commitment);
        commitments[_commitment] = true;
        roots[getRoot()] = true;
        emit CommitmentAdded(_commitment,insertedIndex,block.timestamp);
    }

    function verify (
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input) public returns (bool) {
        uint256 _root = uint256(input[0]);
        uint256 _nullifierHash = uint256(input[1]);

        require(!nullifierHashes[_nullifierHash], "The note has been already spent");
        require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
        require(verifyProof(a, b, c, input), "Invalid withdraw proof");

        nullifierHashes[_nullifierHash] = true;
        emit VerificationMade(_nullifierHash);
        return true;
    }

    function isKnownRoot(uint256 _root) public view returns(bool){
        return roots[_root];
    }

}
