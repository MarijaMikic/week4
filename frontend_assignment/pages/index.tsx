import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers, Contract , utils} from "ethers"
import Head from "next/head"
import 'react-toastify/dist/ReactToastify.css'
import React from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form"
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from "yup"


const sema = yup.object({
    ime: yup.string().required(),
    godine: yup.number().positive().integer().required(),
    adresa: yup.string().required(),
  }).required()

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greetMessage, setGreetMessage] = React.useState('');
	React.useEffect(() => {
		listenGreeting();
        return () => greeterContract.removeAllListeners();
	}, []);
	const listenGreeting = () => {
		try {
			const contract = new Contract(
                '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
				Greeter.abi
			);
			const provider = new providers.JsonRpcProvider('http://localhost:8545');
			const greeterContract = contract.connect(provider.getSigner());
			greeterContract.on('NewGreeting', (greating: string) => {
				console.log(utils.parseBytes32String(greating));
				setGreetMessage(utils.parseBytes32String(greating));
			});
		} catch (error) {
			console.error(error);
		}
	};
    const { register, handleSubmit } = useForm({
        resolver: yupResolver(sema)
      });
  
    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }
    function onSubmit(data: Record <string, any>) {
        console.log(JSON.stringify(data));
    }

    
    
    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>
                <form onSubmit={handleSubmit(onSubmit)}>
                <p>Name</p>
                <input style={{backgroundColor :"grey"}} {...register("ime", { required: true})} />
                <p>Age</p>
                <input style={{backgroundColor :"grey"}} {...register("godine", { required: true})} />
                <p>Address</p>
                <input style={{backgroundColor :"grey"}} {...register("adresa", { required: true})} />
                <p></p>
                <input style={{backgroundColor :"green"}} type="submit"/>
                <p>New greating: {greetMessage}</p>
                </form>
            </main>
        </div>
    )
}
