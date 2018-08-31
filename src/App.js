import React, { Component } from 'react'
import './App.css';
import 'react-toastify/dist/ReactToastify.min.css'

import Appbar from 'muicss/lib/react/appbar'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import Panel from 'muicss/lib/react/panel'
import Select from 'muicss/lib/react/select'
import Option from 'muicss/lib/react/option'

import Web3 from 'web3'
import Etherscan from 'etherscan-api'
import _ from 'lodash'
import {CopyToClipboard} from 'react-copy-to-clipboard'
import LazyLoad from 'react-lazyload'
import {toast, ToastContainer} from 'react-toastify'

const TOKEN_API = '97JCGNIUANRCGTMSG3JZMHH2E8FI4FRYM1'
const CONTRACT_ADDR = '0x3430d3fc79e35f33bb69c4a0b4b89bc9ee107897'
const ethAPI = new Etherscan.init(TOKEN_API, 'kovan', 3000)
const web3Api = new Web3(Web3.givenProvider || "http://localhost:8545")

export const getAccountAddr = (callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    return web3Api.eth.getAccounts()
        .then((res) => { callback(null, res) })
        .catch((err) => { callback(err) })
}

export const getWalletBalance = (accountId, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    //validation
    if(!web3Api.utils.isAddress(accountId)){
        callback(Error('Address is invalid'))
        return false
    }

    return ethAPI.account.balance(accountId)
        .then(({result}) => {
            callback(null, result)
        })
        .catch((err) => {
            callback(err)
        })
}

export const getContractInstance = (contractAddr, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    let abiArr, contract
    return ethAPI.contract.getabi(contractAddr)
        .then(({result}) => {
            abiArr = JSON.parse(result)
            contract = new web3Api.eth.Contract(abiArr, contractAddr)
            callback(null, contract)
        })
        .catch((err) => {
            console.error(err)
            callback(err)
        })
}

export const getContractBalance = (instance, accountId, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    //validation
    if(!web3Api.utils.isAddress(accountId)){
        callback(Error('Address is invalid'))
        return false
    }

    return instance.methods
        .balanceOf(accountId)
        .call({from: accountId})
        .then((res) => {callback(null, res)})
        .catch((err) => {callback(err)})
}

export const setContractDeposit = (instance, accountId, amount, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    let wei = web3Api.utils.toWei(amount, 'ether')
    return instance.methods
        .deposit()
        .send({from: accountId, value: wei})
        .on('confirmation', (confirmationNumber, receipt) => {
            if(confirmationNumber === 5){ //we'll assume > 5 is legit
                callback(null, receipt)
            }
        })
        .on('error', (err) => {
            callback(err)
            console.error(err)
        })
}

export const setContractWithdraw = (instance, accountId, amount, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    let wei = web3Api.utils.toWei(amount, 'ether')

    return instance.methods
        .withdraw(wei)
        .send({from: accountId})
        .on('confirmation', (confirmationNumber, receipt) => {
            if(confirmationNumber === 5){ //we'll assume > 5 is legit
                callback(null, receipt)
            }
        })
        .on('error', (err) => {
            callback(err)
            console.error(err)
        })
}

export const getContractLogs = (instance, callback) => {
    if(!Web3.givenProvider) { callback(Error('Not Connected')); return}
    let logs = []
    return instance
        .getPastEvents("allEvents", {
            fromBlock: 'earliest',
            topics: [['0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364', '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c']] //TODO: make more dynamic so we can set these via a provider or wrapper component
        })
        .then((res) => {
            logs = _.sortBy(res, ['blockNumber']).reverse()
            callback(null, logs)
        })
        .catch((err) => {callback(err)})
}

class App extends Component {
    constructor(props){
        super(props)
        this.state = {
            hasError: false
        }
    }

    componentDidCatch(error) {
        this.setState({ hasError: true, errMessage: error });
    }

    render() {
        return (
            <div className="App">
                {this.state.hasError ? <Panel>{this.state.errMessage}</Panel> : null}
                <ToastContainer />
                <Dashboard />
            </div>
        );
    }
}

class Dashboard extends Component {
    constructor(props){
        super(props)
        this.state = {
            vaultAddr: CONTRACT_ADDR,
            availableWallets: [],
            walletAddr: undefined,
            walletBalance: 0,
            vaultBalance: 0,
            hasError: false,
            isInit: false,
            logs: [],
            updating: false,
            balanceChange: false
        }

        this.handleWalletChange = this.handleWalletChange.bind(this)
        this.performVaultDeposit = this.performVaultDeposit.bind(this)
        this.performVaultWithdraw = this.performVaultWithdraw.bind(this)
        this.performSearch = this.performSearch.bind(this)
        this.performGetLogs = this.performGetLogs.bind(this)
        this.refreshAccountsList = this.refreshAccountsList.bind(this)
        this.handleWalletChange = this.handleWalletChange.bind(this)
        this.refreshWalletBalance = this.refreshWalletBalance.bind(this)
        this.refreshVaultBalance = this.refreshVaultBalance.bind(this)
        this.contractInstance = false
    }

    componentDidCatch(error) {
        this.setState({ hasError: true, errMessage: error });
    }

    componentDidMount(){
        getContractInstance(this.state.vaultAddr, (err, instance) => {
            if(err){
                this.setState({isInit: false, hasError: true, errMessage: err.toString()})
                return
            }
            this.contractInstance = instance
            this.setState({isInit: true})
        })
    }

    componentWillUnmount(){
        this.contractInstance = null
    }

    componentDidUpdate(prevProps, prevState){
        if(!_.isEqual(prevState.walletAddr, this.state.walletAddr) && this.state.walletAddr){
            this.refreshWalletBalance()
            this.refreshVaultBalance()
        } else if(!_.isEqual(prevState.balanceChange, this.state.balanceChange) && this.state.balanceChange && !this.state.updating){
            //user action of a deposit/withdraw, so balance check and update logs as well
            this.refreshWalletBalance()
            this.refreshVaultBalance()
            this.performGetLogs()
            this.setState({balanceChange: false})
        }
    }

    handleWalletChange(walletId){
        this.setState({walletAddr: walletId})
    }

    performVaultWithdraw(rawAmount){
        const {walletAddr} = this.state
        let amount = _.toString(rawAmount)
        this.setState({updating: true}, () =>
            setContractWithdraw(this.contractInstance, walletAddr, amount, (err, res) => {
                if(err){
                    toast.error("Error Withdrawing!")
                    console.error(err)
                }
                this.setState({updating: false, balanceChange: true})

            })
        )
    }

    performVaultDeposit(rawAmount){
        const {walletAddr} = this.state
        this.setState({updating: true}, () =>
            setContractDeposit(this.contractInstance, walletAddr, rawAmount, (err, res) => {
                if(err){
                    toast.error("Error Depositing!")
                    console.error(err)
                }
                this.setState({updating: false, balanceChange: true})
            })
        )
    }

    refreshAccountsList(){

        this.setState({updating: true}, () => {
            return getAccountAddr ((err, accounts) => {
                let hasAccounts = accounts && accounts.length > 0
                let accts = hasAccounts ? accounts : []
                if(err){
                    toast.error("Error Refreshing Accounts!")
                    console.error(err)
                    return
                }
                this.setState({
                    walletAddr: _.head(accounts),
                    availableWallets: accts,
                    updating: false
                })
            })
        })
    }

    refreshWalletBalance(){
        const {walletAddr} = this.state

        this.setState({updating: true}, () => {
            return getWalletBalance (walletAddr, (err, balance) => {
                if(err){
                    toast.error("Error Refreshing Wallet Balance!")
                    console.error(err)
                }
                this.setState({walletAddr, walletBalance: balance || -1, updating: false})
            })
        })
    }

    refreshVaultBalance(){
        const {walletAddr, vaultAddr} = this.state

        this.setState({updating: true}, () => {
            return getContractBalance (this.contractInstance,walletAddr, (err, balance) => {
                if(err){
                    toast.error("Error Refreshing Vault Balance!")
                    console.error(err)
                }
                this.setState({vaultAddr, walletAddr, vaultBalance: balance || 0, updating: false})
            })
        })
    }

    performSearch(address, callback){
        return getContractBalance(this.contractInstance, address, callback) //forward back to search component
    }

    performGetLogs(){

        this.setState({updating: true}, () => {
            return getContractLogs(this.contractInstance, (err, logs) => {
                if(err)
                    this.setState({hasError: true, errMessage: err.toString(), updating:false})
                else
                    this.setState({logs, updating:false})
            })
        })

    }

    render() {
        if(this.state.hasError) return <Panel><div className="mui--text-danger"><i className="fas fa-exclamation-triangle" /> {this.state.errMessage}</div></Panel>
        else if(!this.state.isInit) return <Panel>Starting..</Panel>

        return (
            <div className={`dashboard ${this.state.updating ? 'api-updating' : ''}`}>
                <Appbar />
                <Container>
                    <Row>
                        <Col xl="8" xl-offset={2} lg={12}>
                            <WalletOptions
                                updating={this.state.updating}
                                accounts={this.state.availableWallets}
                                address={this.state.walletAddr}
                                onSelect={this.handleWalletChange}
                                accountsFunc={this.refreshAccountsList} />
                        </Col>
                    </Row>
                    <Row>
                        <Col xl="4" xl-offset={2} lg={6}>
                            <DepositOptions
                                updating={this.state.updating}
                                address={this.state.walletAddr}
                                balance={this.state.walletBalance}
                                onSubmit={this.performVaultDeposit}
                                balanceFunc={this.refreshWalletBalance} />
                        </Col>
                        <Col xl="4" lg={6}>
                            <WithdrawOptions
                                updating={this.state.updating}
                                address={this.state.walletAddr}
                                balance={this.state.vaultBalance}
                                onSubmit={this.performVaultWithdraw}
                                balanceFunc={this.refreshVaultBalance} />
                        </Col>
                    </Row>
                </Container>
                <hr/>
                <Container>
                    <Row>
                        <Col xl="8" xl-offset={2} lg={12}>
                            <SearchBalance searchFunc={this.performSearch}/>
                        </Col>
                    </Row>
                </Container>
                <hr/>
                <Container>
                    <Row>
                        <Col xl="8" xl-offset={2} lg={12}>
                            <TransactionsList updating={this.state.updating} logs={this.state.logs} logsFunc={this.performGetLogs}/>
                        </Col>
                    </Row>
                </Container>
                <ToastContainer />
            </div>
        );
    }
}

export default App;

class SearchBalance extends Component {
    constructor(props){
        super(props)

        this.state = {
            address: false,
            balance: false,
            searching: false,
            searched: false,
            hasError: false
        }

        this.onSubmit = this.onSubmit.bind(this)
        this.handleOnChange = this.handleOnChange.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.onInputChange = _.debounce(this.onInputChange,1000);
    }

    onSubmit(event){
        event.preventDefault()
        if(this.state.searching) return false

        this.setState({searched:false, searching: true}, () => {
            this.props.searchFunc(this.state.address, (err, balance) => {
                if(err){
                    this.setState({searched: false, searching: false, hasError: true, errMessage: err.toString()})
                } else {
                    this.setState({searched: true, searching: false, balance: balance})
                }
            })
        })
    }

    onInputChange(event){
        let value = event.target.value
        this.setState({address: value, searching: false, searched: false})
    }

    handleOnChange(event){
        this.setState({address: event.target.value, searching: false, searched: false, hasError: false, errMessage: ''})
    }

    renderSearchResult(){
        if(this.state.hasError) return <div className="mui--text-danger mui--text-caption">{this.state.errMessage}</div>
        if(this.state.searching) return <Panel>Searching..</Panel>
        if(!this.state.searched) return null

        return(<React.Fragment>
                <Container>
                    <Row>
                        <Col md={12}>
                            <Panel>
                                <div>Address: {this.state.address}</div>
                                <div>
                                    Vault Balance: {web3Api.utils.fromWei(`${this.state.balance}`)} ETH</div>
                            </Panel>
                        </Col>
                    </Row>
                </Container>
            </React.Fragment>
        )
    }


    render() {
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-search" /></div>
                <div className="mui--text-headline">Find Wallet Balance</div>
                <Container fluid={true}>
                    <Row>
                        <Col md={12}>
                            <Form onSubmit={this.onSubmit}>
                                <Input label={'Enter a wallet address'} floatingLabel={true} onChange={this.handleOnChange} invalid={this.state.invalid}/>
                                {this.renderSearchResult()}
                                <div className={'actions'}>
                                    <Button className={"searchButton"} color={"primary"} onClick={this.onSubmit} disabled={this.state.searching || this.state.searched}>Get Balance</Button>
                                </div>
                            </Form>
                        </Col>
                    </Row>
                </Container>
            </Panel>
        )
    }
}
export class DepositOptions extends Component {
    constructor(props){
        super(props)

        this.state = {
            value: 0,
            hasError: false,
            errMessage: ''
        }

        this.onSubmit = this.onSubmit.bind(this)
        this.onChange = this.onChange.bind(this)
        this.onRefresh = this.onRefresh.bind(this)
    }

    onChange(event){
        this.setState({value: event.target.value, hasError: false, errMessage: false})
    }

    onRefresh(event){
        event.preventDefault()
        this.props.balanceFunc(this.props.account)
    }
    onSubmit(event){
        event.preventDefault()
        if(this.props.updating) return false
        let amount
        let balance = web3Api.utils.fromWei(`${this.props.balance}`) || 0
        if(!this.state.value || this.state.value <= 0){
            this.setState({hasError: true, errMessage: 'Value cannot be 0 or negative'})
            return console.error('Value cannot be 0 or negative')
        } else if(this.state.value > balance){
            this.setState({hasError: true, errMessage: 'Value over max balance'})
            return console.error('Value over max balance')
        }

        amount = _.toString(this.state.value)
        if(!amount){
            this.setState({hasError: true, errMessage: 'Invalid value'})
            return console.error('Value over max balance')
        }

        this.setState({hasError: false, errMessage: ''}, () => {
            this.props.onSubmit(amount)
        })
    }

    render() {
        if(!this.props.address) return null
        let balance = web3Api.utils.fromWei(`${this.props.balance}`) || 0
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-arrow-circle-down positiveColor" /></div>
                <div className="mui--text-headline">Deposit To Vault</div>
                <Form onSubmit={this.onSubmit}>
                    <Input placeholder={"Amount"} type={"number"} value={this.state.value} onChange={this.onChange} invalid={this.state.hasError} required/>
                    {this.state.hasError && <div className="mui--text-danger mui--text-caption">{this.state.errMessage}</div>}
                    <div className="mui--text-caption balance">
                        Wallet Balance: {balance} ETH
                        <Button variant={"flat"} size={"small"} onClick={this.onRefresh} disabled={this.props.updating}><i className="fas fa-sync" /></Button></div>
                    <div className={'actions'}>
                        <Button color={"primary"} disabled={this.props.balance <= 0 || this.props.updating} onClick={this.onSubmit} > Deposit</Button>
                    </div>
                </Form>
            </Panel>
        );
    }
}

export class WithdrawOptions extends Component {
    constructor(props){
        super(props)

        this.state = {
            value: 0,
            invalid: false
        }

        this.onSubmit = this.onSubmit.bind(this)
        this.onChange = this.onChange.bind(this)
        this.onRefresh = this.onRefresh.bind(this)
    }

    onChange(event){
        this.setState({value: event.target.value, invalid: false})
    }

    onRefresh(event){
        event.preventDefault()
        this.props.balanceFunc(this.props.account)
    }

    onSubmit(event){
        event.preventDefault()
        if(this.props.updating) return false

        let balance = web3Api.utils.fromWei(`${this.props.balance}`) || 0

        if(!this.state.value || this.state.value <= 0){
            this.setState({invalid: 'Value cannot be 0 or negative'})
            return console.error('Value cannot be 0 or negative')
        } else if(this.state.value > balance){
            this.setState({invalid: 'Value over max balance'})
            return console.error('Value over max balance')
        }
        this.setState({invalid: false}, () => {
            this.props.onSubmit(this.state.value)
        })
    }
    render() {
        if(!this.props.address) return null
        let balance = web3Api.utils.fromWei(`${this.props.balance}`) || 0
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-arrow-circle-up negativeColor" /></div>
                <div className="mui--text-headline">Withdraw From Vault</div>
                <Form onSubmit={this.onSubmit}>
                    <Input placeholder={"Amount"} type={"number"} value={this.state.value} onChange={this.onChange} invalid={this.state.invalid} required/>
                    {this.state.invalid && <div className="mui--text-danger mui--text-caption">{this.state.invalid}</div>}
                    <div className="mui--text-caption balance">
                        Vault Balance: {balance} ETH
                        <Button variant={"flat"} size={"small"} onClick={this.onRefresh} disabled={this.props.updating}><i className="fas fa-sync" /></Button>
                    </div>
                    <div className={'actions'}>
                        <Button color={"primary"} disabled={this.props.balance <= 0 || this.props.updating} onClick={this.onSubmit} > Withdraw</Button>
                    </div>
                </Form>
            </Panel>
        );
    }
}

export class WalletOptions extends Component {
    constructor(props){
        super(props)
        this.onSelect = this.onSelect.bind(this)
        this.onSubmit = this.onSubmit.bind(this)
    }

    shouldComponentUpdate(nextProps){
        if(!_.isEqual(nextProps.accounts, this.props.accounts))
            return true
        else if(!_.isEqual(nextProps.address, this.props.address) && this.props.address)
            return true
        else if(!_.isEqual(nextProps.updating, this.props.updating))
            return true
        return false
    }

    componentDidMount(){
       this.props.accountsFunc()
    }

    onSubmit(event){
        event.preventDefault()
        if(this.props.updating) return false
        this.props.accountsFunc()
    }

    onSelect(event){
        if(this.props.onSelect)
            this.props.onSelect(event.target.value)
    }

    render() {
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-wallet" /></div>
                <div className="mui--text-headline">Selected Wallet</div>
                <Form inline={true} onSubmit={this.onSubmit}>
                    <Select name="wallet" value={this.props.address} onChange={this.onSelect} disabled={this.props.updating}>
                        {this.props.accounts.map(wallet => <Option key={wallet} value={wallet} label={wallet} />)}
                    </Select>
                    <Button variant={"flat"} onClick={this.onSubmit} disabled={this.props.updating}><i className="fas fa-sync" /></Button>
                </Form>
            </Panel>
        );
    }
}

class TransactionsList extends Component {
    constructor(props){
        super(props)

        this.handleOnClick = this.handleOnClick.bind(this)
    }

    componentDidMount(){
       this.props.logsFunc()
    }

    handleOnClick(event){
        event.preventDefault()
        this.props.logsFunc()
    }

    onCopy(){
        toast.success('Copied address to clipboard')
    }

    render() {

        const isDeposit = (type) => _.isEqual(type, 'Deposit')
        const isWithdraw = (type) => _.isEqual(type, 'Withdraw')
        const getColor = (event) => isDeposit(event) ? 'positiveColor' : isWithdraw(event) ? 'negativeColor' : ''
        return (
            <Panel className={'vaultTransactionsPanel'}>
                <div className="mui--text-headline">
                    Recent Vault Transactions
                    <Button variant={"flat"} size={"small"} onClick={this.handleOnClick} disabled={this.props.updating}><i className="fas fa-sync" /></Button>
                </div>
                <hr />
                <Container className={"overflowList"}>
                    {this.props.logs.map(({address, returnValues: {amount, user}, event, id}) => {
                        return(
                            <LazyLoad key={id} overflow throttle={100} height={72}>
                                <Panel className={'logMessage ' + getColor(event)}>
                                    <Row>
                                        <Col lg={2} sm={2}>{isDeposit(event) ? <i className="fas fa-arrow-circle-down positiveColor" /> : isWithdraw(event) ? <i className="fas fa-arrow-circle-up negativeColor" /> : ''}</Col>
                                        <Col lg={5} sm={8} className={'middleContent'}>
                                            <Row>
                                                <Col lg={12}>{event}</Col>
                                            </Row>
                                            <Row>
                                                <Col lg={12}>
                                                    <CopyToClipboard text={user} className={'copy'} onCopy={this.onCopy}>
                                                        <div>
                                                            <span>{user ? user : 'n/a'} </span> <i className="far fa-copy" />
                                                        </div>
                                                    </CopyToClipboard>
                                                </Col>
                                            </Row>
                                        </Col>
                                        <Col lg={5} sm={12} className={'amount'}>{web3Api.utils.fromWei(`${amount}`)} ETH</Col>
                                    </Row>
                                </Panel>
                            </LazyLoad>
                        )
                    })}
                </Container>
            </Panel>
        );
    }
}
