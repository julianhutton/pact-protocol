import hre from "hardhat";

async function main() {
  console.log("Deploying TrustAttestation to", hre.network.name, "...");

  const contract = await hre.viem.deployContract("TrustAttestation");

  console.log("TrustAttestation deployed to:", contract.address);

  if (hre.network.name === "baseSepolia") {
    console.log(
      `Explorer: https://sepolia.basescan.org/address/${contract.address}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
