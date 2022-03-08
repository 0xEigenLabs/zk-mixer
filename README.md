### Mixer

A coin mixer implementation based on ZKP for privacy-preserving DeFi and DAO. NOTE that it's not production ready.

### Components

- Circuits
	- mixer.circom
	- get_merkle_root.circom

-  Contracts
	- Mixer
	- Merkle

### Compile

```
yarn test
```

#### Compile circuits

```
$ cd circuit && ./run.sh mixer
```
Wait until you are asked to type in the secret phase, twice!!

### How it work

Mixer is built on `Groth16` and `Merkle Tree`.

* Groth16

Groth16 is one of the most famous zksnark proving schemes (in addition to pghr13, gm17, etc.). 
Compared with the previous proof protocol, groth16 has the characteristics of small proof data 
(only three proof data) and fast verification speed (only one equation needs to be verified). 
At present, groth16 has been widely used in many projects, such as zcash, filecoin, etc.
Groth16 is a zero knowledge proof protocol proposed by Daniel Jens growth in his paper 
"on the size of pairing based non interactive arguments" published in 2016.
The name of the general algorithm is composed of the first letter of the author’s surname 
and the year.

More details are presented [here](https://eprint.iacr.org/2016/260.pdf).

* MIMC
MiMC is a block cipher and hash function family designed specifically for SNARK applications. 
The low multiplicative complexity of MiMC over prime fields makes it suitable for ZK-SNARK 
applications such as ZCash.
More details are [here](https://byt3bit.github.io/primesym/mimc/).

* `yarn generate`
This operation produces 4 files in circuit directory:
>* input.json :  secret for mixer to generate witness, a sample is as below: 
```
{
    "root": "6006452839415899035733807029325942815929888768074345937414569668512067894100",
    "nullifierHash": "3701224944747537563701225775873437347582519438989321326160774689502152321319",
    "secret": "10",
    "paths2_root": [
        3174904703,
        1831855034,
        2927866351,
        3904382600,
        4026780824,
        2259814112,
        3460561431,
        3054720229
    ],
    "paths2_root_pos": [
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1
    ]
}
```
where `root` is the merkle root, and `nullifierHash` is nullifier to check whether the commitment has been withdrawed. The secret is used to generate the commitment by hash function in binary format, paths2_root        is the salt for each non-leaf node to compute it's hash.  And paths2_root_pos is 0 or 1, used as a sign function to choose whether paths2_root as `xIn` and previous path2_root as `k`, and vice versa. The circom code shown as below:

```
merkle_root[v].x_in <== paths2_root[v] - paths2_root_pos[v] * (paths2_root[v] - merkle_root[v-1].out);
merkle_root[v].k<== merkle_root[v-1].out - paths2_root_pos[v]* (merkle_root[v-1].out - paths2_root[v]);
```

>* public.json: includes nullifierHash and root.
>* cmt.json: the parameter of deposit

* `./run.sh mixer`

Here we use `Groth16` and curve bn128 to generate verification key and proof key.  More details are presented in reference 1.  One point should be mentioned is [powersoftau](https://eprint.iacr.org/2017/1050), which adopts MPC to generate verifiable Random Beacon as CRS,  to secure their secret randomness throughout the duration of the protocol.

* `npx hardhat node`

Start the local node.

* `yarn test`

Run the test.

### Contribution

Use [solium](https://ethlint.readthedocs.io/en/latest/user-guide.html) to format the solidity code.

### Notices
* fix the circuits to verify the new root

This is raised by the inconsistent Merkle Root calculation, we use getRootEx to calculate the root.
This way will expose the `path_root_pos` information, which is considered private in Mixer circuit.

* tx origin check before deposit

### Reference
1. https://keen-noyce-c29dfa.netlify.com/#2
2. https://blog.iden3.io/first-zk-proof.html
