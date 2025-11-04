import {
    BrowserProvider,
    Contract,
    Eip1193Provider,
    JsonRpcSigner,
    formatEther,
    parseEther,
  } from 'ethers'
  import abiJson from '@/lib/contractABI.json'
  import { contractAddress, ChainId } from '@/lib/constants'

  const abi = abiJson

  export function getInjectedProvider(): Eip1193Provider | null {
    if (typeof window === 'undefined') return null
    const anyWindow = window as unknown as { ethereum?: Eip1193Provider }
    return anyWindow.ethereum ?? null
  }

  export function getBrowserProvider(): BrowserProvider {
    const injected = getInjectedProvider()
    if (!injected) {
      throw new Error('지갑(예: MetaMask)이 설치되어 있지 않습니다.')
    }
    return new BrowserProvider(injected)
  }

  export async function getSigner(): Promise<JsonRpcSigner> {
    const provider = getBrowserProvider()
    return await provider.getSigner()
  }

  export async function ensureNetwork(): Promise<void> {
    const provider = getBrowserProvider()
    const network = await provider.getNetwork()
    if (Number(network.chainId) !== ChainId) {
      throw new Error(`네트워크가 올바르지 않습니다. 필요한 체인 ID: ${ChainId}`)
    }
  }

  export async function connectWallet(): Promise<string> {
    const injected = getInjectedProvider()
    if (!injected || !('request' in injected)) {
      throw new Error('EIP-1193 provider를 찾을 수 없습니다.')
    }
    const accounts = (await injected.request({
      method: 'eth_requestAccounts',
    })) as string[]
    if (!accounts || accounts.length === 0) {
      throw new Error('지갑 계정을 가져올 수 없습니다.')
    }
    return accounts[0]
  }

  export async function getContract(withSigner = false): Promise<Contract> {
    const provider = getBrowserProvider()
    if (withSigner) {
      const signer = await getSigner()
      return new Contract(contractAddress, abi, signer)
    }
    return new Contract(contractAddress, abi, provider)
  }

  export async function checkContractExists(): Promise<boolean> {
    try {
      await ensureNetwork()
      const provider = getBrowserProvider()
      const code = await provider.getCode(contractAddress)
      return code !== '0x' && code !== null
    } catch {
      return false
    }
  }

  export async function readContractBalance(): Promise<string> {
    try {
      await ensureNetwork()

      // 컨트랙트 존재 여부 확인
      const exists = await checkContractExists()
      if (!exists) {
        throw new Error(`컨트랙트가 주소 ${contractAddress}에 존재하지 않습니다. Sepolia 테스트넷에 올바른 주소인지 확인해주세요.`)
      }

      const contract = await getContract(false)
      const raw = (await contract.getBalance()) as bigint
      return formatEther(raw)
    } catch (err: any) {
      // 이미 의미있는 에러 메시지가 있으면 그대로 전달
      if (err.message && !err.message.includes('컨트랙트 잔액 조회 실패')) {
        throw err
      }
      throw new Error(`컨트랙트 잔액 조회 실패: ${err.message || '알 수 없는 오류'}`)
    }
  }

  export async function readOwner(): Promise<string> {
    try {
      await ensureNetwork()

      // 컨트랙트 존재 여부 확인
      const exists = await checkContractExists()
      if (!exists) {
        throw new Error(`컨트랙트가 주소 ${contractAddress}에 존재하지 않습니다. Sepolia 테스트넷에 올바른 주소인지 확인해주세요.`)
      }

      const contract = await getContract(false)
      return (await contract.owner()) as string
    } catch (err: any) {
      // 이미 의미있는 에러 메시지가 있으면 그대로 전달
      if (err.message && !err.message.includes('소유자 조회 실패')) {
        throw err
      }
      throw new Error(`소유자 조회 실패: ${err.message || '알 수 없는 오류'}`)
    }
  }

  export async function sendTip(amountEth: string): Promise<string> {
    await ensureNetwork()
    const contract = await getContract(true)
    const tx = await contract.tip({ value: parseEther(amountEth) })
    const receipt = await tx.wait()
    return receipt?.hash ?? tx.hash
  }

  export async function withdrawTips(): Promise<string> {
    await ensureNetwork()
    const contract = await getContract(true)
    const tx = await contract.withdrawTips()
    const receipt = await tx.wait()
    return receipt?.hash ?? tx.hash
  }

  export async function getAccountAndNetwork(): Promise<{
    account?: string
    chainId?: number
    chainName?: string
  }> {
    try {
      const provider = getBrowserProvider()
      const signer = await provider.getSigner()
      const address = await signer.getAddress().catch(() => undefined)
      const net = await provider.getNetwork()
      return {
        account: address,
        chainId: Number(net.chainId),
        chainName: net.name,
      }
    } catch {
      return {}
    }
  }