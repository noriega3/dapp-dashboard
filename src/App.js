import React, { Component } from 'react'
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
import './App.css';
import Web3 from 'web3'
import Etherscan from 'etherscan-api'
import _ from 'lodash'
import {CopyToClipboard} from 'react-copy-to-clipboard'
import LazyLoad from 'react-lazyload'

const TOKEN_API = '97JCGNIUANRCGTMSG3JZMHH2E8FI4FRYM1'
const CONTRACT_ADDR = '0x3430d3fc79e35f33bb69c4a0b4b89bc9ee107897'
const ethAPI = new Etherscan.init(TOKEN_API, 'kovan', 3000)
const web3Api = new Web3(Web3.givenProvider || "http://localhost:8545");

/*
 () Allow the user to deposit.
 () Allow the user to withdraw.
 (X) Show the user’s current Ether balance in his wallet.
 (X) Show the user’s current Ether balance in the Vault.
 (X) Show recent deposit and withdraw events from all users.
 */

export const getAccountAddr = async () => {
    return await web3Api.eth.getAccounts()
}

export const getWalletBalance = async (accountId) => {
    let data = await ethAPI.account.balance(accountId)
    return data.result;
}

export const getContractInstance = async () => {
    let abiArr = await ethAPI.contract.getabi(CONTRACT_ADDR);
    abiArr = await JSON.parse(abiArr.result)
    return new web3Api.eth.Contract(abiArr, CONTRACT_ADDR);
}

export const getContractBalanceUser = async (instance, accountId) => {
    return await instance.methods.balanceOf(accountId).call({from: accountId})
}

export const setContractDeposit = async (instance, accountId, amount) => {
    console.log(instance.methods)
    return await instance.methods.deposit(amount).call({from: accountId})
}

export const setContractWithdraw = async (instance, accountId, amount) => {
    console.log(instance.methods)
    return await instance.methods.withdraw(amount).call({from: accountId})
}
class App extends Component {
    constructor(props){
        super(props)
        this.state = {
            vaultAddr: CONTRACT_ADDR,
            walletAddr: -1,
            walletBalance: 0,
            vaultBalance: 0
        }

        this.handleWalletChange = this.handleWalletChange.bind(this)
        this.performDeposit = this.performDeposit.bind(this)
        this.performWithdraw = this.performWithdraw.bind(this)
    }

    async componentDidMount(){
        this.contractInstance = await getContractInstance()

    }

    componentWillUnmount(){
        this.contractInstance = null
    }
    async handleWalletChange(walletId){
        let walletBalance = await getWalletBalance(walletId)
        let vaultBalance = await getContractBalanceUser(this.contractInstance, walletId)
        this.setState({walletAddr: walletId, walletBalance, vaultBalance})
    }

    async performWithdraw(amount){
        const {walletAddr} = this.state
        let result = await setContractWithdraw(this.contractInstance, walletAddr, amount)
        console.log('result', result)
        this.setState((prevState) => ({walletBalance: prevState.walletBalance+amount, vaultBalance: prevState.vaultBalance-amount}))
    }

    async performDeposit(amount){
        const {walletAddr} = this.state
        let result = await setContractDeposit(this.contractInstance, walletAddr, amount)
        console.log('result', result)

        this.setState((prevState) => ({walletBalance: prevState.walletBalance-amount, vaultBalance: prevState.vaultBalance+amount}))
    }

  render() {
    return (
      <div className="App">
          <Appbar />
          <Container>
              <Row>
                  <Col xl="8" xl-offset={2} lg={12}>
                      <WalletOptions onSelect={this.handleWalletChange.bind(this)}/>
                  </Col>
              </Row>
              <Row>
                  <Col xl="4" xl-offset={2} lg={6}>
                      <DepositOptions address={this.state.walletAddr} balance={this.state.walletBalance} onSubmit={this.performDeposit}/>
                  </Col>
                  <Col xl="4" lg={6}>
                      <WithdrawOptions address={this.state.vaultAddr} balance={this.state.vaultBalance} onSubmit={this.performWithdraw}/>
                  </Col>
              </Row>
          </Container>
        <hr/>
        <Container>
            <Row>
                <Col xl="8" xl-offset={2} lg={12}>
                    <SearchBalance />
                </Col>
            </Row>
        </Container>
      <hr/>
          <Container>
          <Row>
              <Col xl="8" xl-offset={2} lg={12}>
                  <TransactionsList address={this.state.vaultAddr} />
              </Col>

          </Row>
          </Container>
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
            invalid: false
        }

        this.handleClick = this.handleClick.bind(this)
        this.handleOnChange = this.handleOnChange.bind(this)
        this.onInputChange = this.onInputChange.bind(this)
        this.onInputChange = _.debounce(this.onInputChange,1000);
    }

    async componentDidMount(){
        this.contractInstance = await getContractInstance()
    }

    componentWillUnmount(){
        this.contractInstance = null
    }

    handleClick(event){
        event.preventDefault()

        //validation
        if(!web3Api.utils.isAddress(this.state.address)){
            this.setState({invalid: 'Address is invalid'})
            return false
        }

        this.setState({searched:false, searching: true}, async () => {
            try {
                let balance = await getContractBalanceUser(this.contractInstance, this.state.address)
                this.setState({balance, searched:true, searching: false})
            } catch(err) {
                this.setState({balance: 0, searched:false, searching: false, invalid: err.toString()})
            }
        })
    }

    onInputChange(event){
        let value = event.target.value
        this.setState({address: value, searching: false, searched: false})
    }

    handleOnChange(event){
        this.setState({address: event.target.value, searching: false, searched: false, invalid: false})
    }

    renderSearchResult(){
        if(this.state.invalid) return <div className="mui--text-danger mui--text-caption">{this.state.invalid}</div>
        if(this.state.searching) return <Panel>Searching..</Panel>
        if(!this.state.searched) return null


        return(<React.Fragment>
                <Container>
                    <Row>
                        <Col md={12}>
                            <Panel>
                                <div>Address: {this.state.address}</div>
                                <div>Vault Balance: {this.state.balance}</div>
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
                            <Form>
                                <Input label={'Enter a wallet address'} floatingLabel={true} onChange={this.handleOnChange} invalid={this.state.invalid}/>
                                {this.renderSearchResult()}
                                <div className={'actions'}>
                                    <Button className={"searchButton"} color={"primary"} onClick={this.handleClick} disabled={this.state.searching || this.state.searched}>Get Balance</Button>
                                </div>
                            </Form>
                        </Col>
                    </Row>
                </Container>
            </Panel>
        )
    }
}
class DepositOptions extends Component {
    constructor(props){
        super(props)

        this.state = {
            value: 0,
            invalid: false
        }

        this.onSubmit = this.onSubmit.bind(this)
        this.onChange = this.onChange.bind(this)
    }

    onChange(event){
        this.setState({value: event.target.value, invalid: false})
    }
    onSubmit(event){
        event.preventDefault()
        if(!this.state.value || this.state.value <= 0){
            this.setState({invalid: 'Value cannot be 0 or negative'})
            return console.error('Value cannot be 0 or negative')
        } else if(this.state.value > this.props.balance){
            this.setState({invalid: 'Value over max balance'})
            return console.error('Value over max balance')
        }
        this.setState({invalid: false}, () => {
            this.props.onSubmit(this.state.value)
        })
    }

    render() {
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-arrow-circle-down positiveColor" /></div>
                <div className="mui--text-headline">Deposit</div>
                <Form onSubmit={this.onSubmit}>
                    <Input placeholder={"Amount"} type={"number"} value={this.state.value} onChange={this.onChange} invalid={this.state.invalid} required/>
                    {this.state.invalid && <div className="mui--text-danger mui--text-caption">{this.state.invalid}</div>}
                    <div className="mui--text-caption">Wallet Balance: {this.props.balance}</div>
                    <div className={'actions'}>
                        <Button color={"primary"} disabled={this.props.balance <= 0} onClick={this.onSubmit} > Deposit To Vault</Button>
                    </div>
                </Form>
            </Panel>
        );
    }
}

class WithdrawOptions extends Component {
    constructor(props){
        super(props)

        this.state = {
            value: 0,
            invalid: false
        }

        this.onSubmit = this.onSubmit.bind(this)
        this.onChange = this.onChange.bind(this)
    }

    onChange(event){
        this.setState({value: event.target.value, invalid: false})
    }
    onSubmit(event){
        event.preventDefault()
        if(!this.state.value || this.state.value <= 0){
            this.setState({invalid: 'Value cannot be 0 or negative'})
            return console.error('Value cannot be 0 or negative')
        } else if(this.state.value > this.props.balance){
            this.setState({invalid: 'Value over max balance'})
            return console.error('Value over max balance')
        }
        this.setState({invalid: false}, () => {
            this.props.onSubmit(this.state.value)
        })
    }
    render() {
        return (

            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-arrow-circle-up negativeColor" /></div>
                <div className="mui--text-headline">Withdraw</div>
                <Form onSubmit={this.onSubmit}>
                    <Input placeholder={"Amount"} type={"number"} value={this.state.value} onChange={this.onChange} invalid={this.state.invalid} required/>
                    {this.state.invalid && <div className="mui--text-danger mui--text-caption">{this.state.invalid}</div>}
                    <div className="mui--text-caption">Vault Balance: {this.props.balance}</div>
                    <div className={'actions'}>
                        <Button color={"primary"} disabled={this.props.balance <= 0} onClick={this.onSubmit} > Withdraw From Vault</Button>
                    </div>
                </Form>
            </Panel>
        );
    }
}

class WalletOptions extends Component {
    constructor(props){
        super(props)

        this.state = {
            value: '',
            wallets: []
        }
    }

    async componentDidMount(){
        const wallets = await getAccountAddr()
        this.setState({wallets, value: wallets[0]})

        if(this.props.onSelect)
            this.props.onSelect(wallets[0])
    }

    onSelect(event){

        console.log('selected')
        console.log(event.target)
        this.setState({value: event.target.value});

        if(this.props.onSelect)
            this.props.onSelect(event.target.value)
    }

    render() {
        console.log('this.statewallets', this.state.wallets)
        return (
            <Panel className={'optionsPanel'}>
                <div className={'icon'}><i className="fas fa-wallet" /></div>
                <div className="mui--text-headline">Selected Wallet</div>
                <Form inline={true}>
                    <Select name="wallet" value={this.state.value} onChange={this.onSelect.bind(this)} >
                        {this.state.wallets.map(wallet => <Option key={wallet} value={wallet} label={wallet} />)}
                    </Select>
                    <Button variant={"flat"}><i className="fas fa-sync" /></Button>
                </Form>
            </Panel>
        );
    }
}

class TransactionsList extends Component {
    constructor(props){
        super(props)
        this.state = {
            messages : []
        }
    }
    async componentDidMount(){
        const vaultInstance = await getContractInstance()

        let logs = await vaultInstance.getPastEvents("allEvents", {
            address: this.props.address,
            fromBlock: 'earliest',
            topics: [['0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364', '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c']] //TODO: make more dynamic so we can set these via a provider or wrapper component
        })
        logs = _.sortBy(logs, ['blockNumber']).reverse()

        this.setState({messages: logs})

        //Subscriptions do not currently work with metamask
/*        this.subDeposit = web3Api.eth.subscribe('logs', {
            address: this.props.vaultAddr,
            topics: [
                '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
            ],
        }, this.onDeposit)

        this.subWithdraw = web3Api.eth.subscribe('logs', {
            address: this.props.vaultAddr,
            topics: [
                '0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364',
            ],
        }, this.onWithdrawl)*/
    }
    render() {

        const isDeposit = (type) => _.isEqual(type, 'Deposit')
        const isWithdraw = (type) => _.isEqual(type, 'Withdraw')
        const getColor = (event) => isDeposit(event) ? 'positiveColor' : isWithdraw(event) ? 'negativeColor' : ''
        return (
            <Panel className={'vaultTransactionsPanel'}>
                <div className="mui--text-headline">Recent Vault Transactions</div>
                <hr />
                <Container className={"overflowList"}>
                    {this.state.messages.map(({address, blockNumber, returnValues: {amount, user}, event, id}) => {
                        return(
                            <LazyLoad key={id} overflow throttle={100} height={70}>
                            <Panel className={'logMessage ' + getColor(event)}>
                                <Row>
                                    <Col lg={2} sm={2}>{isDeposit(event) ? <i className="fas fa-arrow-circle-down positiveColor" /> : isWithdraw(event) ? <i className="fas fa-arrow-circle-up negativeColor" /> : ''}</Col>
                                    <Col lg={5} sm={8} className={'middleContent'}>
                                        <Row>
                                            <Col lg={12}>
                                                {event}
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col lg={12}>
                                                <CopyToClipboard text={user} className={'copy'}>
                                                    <div>
                                                        <span>{user ? user : 'n/a'} </span> <i className="far fa-copy" />
                                                    </div>
                                                </CopyToClipboard>
                                            </Col>
                                        </Row>
                                    </Col>
                                    <Col lg={5} sm={12} className={'amount'}>{amount}</Col>
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
