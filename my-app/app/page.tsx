'use client'

import { useState, useEffect } from 'react'
import styles from './page.module.css'
import {
  connectWallet,
  getAccountAndNetwork,
  readContractBalance,
  readOwner,
  sendTip,
  withdrawTips,
} from '@/lib/eth'
import { ChainId } from '@/lib/constants'

export default function Home() {
  const [account, setAccount] = useState<string | undefined>()
  const [chainId, setChainId] = useState<number | undefined>()
  const [balance, setBalance] = useState<string>('0')
  const [owner, setOwner] = useState<string>('')
  const [tipAmount, setTipAmount] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    checkConnection()

    // 지갑 변경 이벤트 리스너
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  useEffect(() => {
    // 지갑이 연결되고 올바른 네트워크일 때만 컨트랙트 데이터 로드
    if (account && chainId === ChainId) {
      loadContractData()
    }
  }, [account, chainId])

  const checkConnection = async () => {
    try {
      const info = await getAccountAndNetwork()
      setAccount(info.account)
      setChainId(info.chainId)
    } catch (err) {
      // 연결되지 않음
    }
  }

  const loadContractData = async () => {
    if (!account || chainId !== ChainId) {
      return
    }

    try {
      const contractBalance = await readContractBalance()
      setBalance(contractBalance)

      const contractOwner = await readOwner()
      setOwner(contractOwner)

      setIsOwner(account.toLowerCase() === contractOwner.toLowerCase())
      setError('')
    } catch (err: any) {
      console.error('컨트랙트 데이터 로드 실패:', err)
      setError(err.message || '컨트랙트 데이터를 불러올 수 없습니다. 네트워크와 컨트랙트 주소를 확인해주세요.')
      setBalance('0')
      setOwner('')
      setIsOwner(false)
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount(undefined)
      setIsOwner(false)
    } else {
      setAccount(accounts[0])
      loadContractData()
    }
  }

  const handleChainChanged = () => {
    window.location.reload()
  }

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    try {
      const address = await connectWallet()
      setAccount(address)
      const info = await getAccountAndNetwork()
      setChainId(info.chainId)

      if (info.chainId !== ChainId) {
        setError(`Sepolia 테스트넷으로 전환해주세요. (현재: ${info.chainName || info.chainId})`)
      } else {
        await loadContractData()
      }
    } catch (err: any) {
      setError(err.message || '지갑 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTip = async () => {
    if (!tipAmount || parseFloat(tipAmount) <= 0) {
      setError('올바른 금액을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const txHash = await sendTip(tipAmount)
      setTipAmount('')
      setError('')
      alert(`트랜잭션 성공! 해시: ${txHash}`)
      await loadContractData()
    } catch (err: any) {
      setError(err.message || '팁 전송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!isOwner) {
      setError('소유자만 인출할 수 있습니다.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const txHash = await withdrawTips()
      alert(`인출 성공! 해시: ${txHash}`)
      await loadContractData()
    } catch (err: any) {
      setError(err.message || '인출에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const isConnected = !!account
  const isCorrectNetwork = chainId === ChainId

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Tip Jar</h1>
          <p className={styles.subtitle}>92313453 유지민</p>

          {!isConnected ? (
            <div className={styles.section}>
              <button
                onClick={handleConnect}
                disabled={loading}
                className={styles.connectButton}
              >
                {loading ? '연결 중...' : '지갑 연결'}
              </button>
              <p className={styles.hint}>
                MetaMask 또는 다른 Web3 지갑을 연결해주세요
              </p>
            </div>
          ) : (
            <div className={styles.section}>
              <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                  <span className={styles.label}>연결된 계정:</span>
                  <span className={styles.value}>
                    {account?.slice(0, 6)}...{account?.slice(-4)}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>네트워크:</span>
                  <span className={styles.value}>
                    {isCorrectNetwork ? (
                      <span className={styles.success}>Sepolia 테스트넷</span>
                    ) : (
                      <span className={styles.error}>잘못된 네트워크</span>
                    )}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>컨트랙트 잔액:</span>
                  <span className={styles.value}>
                    {balance ? `${parseFloat(balance).toFixed(4)} ETH` : '-'}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.label}>소유자:</span>
                  <span className={styles.value}>
                    {owner ? `${owner.slice(0, 6)}...${owner.slice(-4)}` : '-'}
                  </span>
                </div>
              </div>

              {!isCorrectNetwork && (
                <div className={styles.warning}>
                  Sepolia 테스트넷으로 전환해주세요.
                </div>
              )}

              {error && <div className={styles.errorMessage}>{error}</div>}

              <div className={styles.tipSection}>
                <h2 className={styles.sectionTitle}>팁 보내기</h2>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(e.target.value)}
                    placeholder="ETH 금액 입력"
                    className={styles.input}
                    disabled={loading || !isCorrectNetwork}
                  />
                  <button
                    onClick={handleSendTip}
                    disabled={loading || !isCorrectNetwork || !tipAmount}
                    className={styles.primaryButton}
                  >
                    {loading ? '전송 중...' : '팁 보내기'}
                  </button>
                </div>
              </div>

              {isOwner && (
                <div className={styles.withdrawSection}>
                  <h2 className={styles.sectionTitle}>인출</h2>
                  <button
                    onClick={handleWithdraw}
                    disabled={loading || !isCorrectNetwork || parseFloat(balance) === 0}
                    className={styles.withdrawButton}
                  >
                    {loading ? '인출 중...' : '팁 인출'}
                  </button>
                  <p className={styles.hint}>
                    소유자만 컨트랙트의 ETH를 인출할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// window.ethereum 타입 선언
declare global {
  interface Window {
    ethereum?: {
      on: (event: string, handler: (...args: any[]) => void) => void
      removeListener: (event: string, handler: (...args: any[]) => void) => void
    }
  }
}
