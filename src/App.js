import React, { Component } from 'react'
import Appbar from 'muicss/lib/react/appbar'
import Container from 'muicss/lib/react/container'
import Col from 'muicss/lib/react/col'
import Row from 'muicss/lib/react/row'
import Tabs from 'muicss/lib/react/tabs'
import Tab from 'muicss/lib/react/tab'
import Form from 'muicss/lib/react/form'
import Input from 'muicss/lib/react/input'
import Button from 'muicss/lib/react/button'
import Panel from 'muicss/lib/react/panel'
import './App.css';
import Web3 from 'web3'
import Etherscan from 'etherscan-api'
import _ from 'lodash'

const TOKEN_API = '97JCGNIUANRCGTMSG3JZMHH2E8FI4FRYM1'
const CONTRACT_ADDR = '0x3430d3fc79e35f33bb69c4a0b4b89bc9ee107897'
const ethAPI = new Etherscan.init(TOKEN_API, 'kovan', 3000)
const web3Api = new Web3(Web3.givenProvider || "http://localhost:8545");

/*
 () Allow the user to deposit.
 () Allow the user to withdraw.
 (X) Show the user’s current Ether balance in his wallet.
 (X) Show the user’s current Ether balance in the Vault.
 () Show recent deposit and withdraw events from all users.
 */

export const getAccountAddr = async () => {
    let accounts = await web3Api.eth.getAccounts()
    return accounts[0]
}

export const getWalletBalance = async (accountId) => {
    return await ethAPI.account.balance(accountId);
}

export const getContractInstance = async () => {
    let abiArr = await ethAPI.contract.getabi(CONTRACT_ADDR);
    abiArr = await JSON.parse(abiArr.result)
    return new web3Api.eth.Contract(abiArr, CONTRACT_ADDR);
}

export const getContractBalanceUser = async (instance, accountId) => {
    return await instance.methods.balanceOf(accountId).call({from: accountId})
}

class App extends Component {
    constructor(props){
        super(props)
        this.state = {
            vaultAddr: CONTRACT_ADDR,
            walletAddr: -1,
            walletBalance: 0,
            vaultBalance: 0,
        }

    }

    async componentDidMount(){
        try {
            const walletAddr = await getAccountAddr()
            const walletBalance = await getWalletBalance(walletAddr)
            const vaultInstance = await getContractInstance()
            const vaultBalance = await getContractBalanceUser(vaultInstance, walletAddr)

            this.setState({
                walletAddr: walletAddr,
                walletBalance: walletBalance,
                vaultBalance: vaultBalance
            })

        } catch(err){
            console.log(err)
        }
    }

  render() {
    return (
      <div className="App">
          <Appbar />
          <Container>
              <Row>
                  <Col md="12">
                      <Input label={"Wallet Address"} value={this.state.walletAddr} disabled/>
                      <Input label={"Vault Address"} value={this.state.vaultAddr} disabled/>
                  </Col>
              </Row>
              <Row>
                  <Col md="6">
                      <WithdrawalForm />
                      <DepositForm />
                  </Col>
                  <Col md="6">
                      <Tabs onChange={this.onChange} defaultSelectedIndex={0}>
                          <Tab value="pane-1" label="Vault" onActive={this.onActive}>
                              <div>Balance: {this.state.vaultBalance}</div>
                          </Tab>
                          <Tab value="pane-2" label="Wallet">
                              <div>Balance: {this.state.walletBalance}</div>
                          </Tab>
                      </Tabs>
                  </Col>
              </Row>
              <Row>
                  <Col md="12">
                      <div className="mui--text-subhead">Get Balance</div>

                      <Form inline={true}>
                          <Input label={"Get Balance For User"} />
                          <Button color={"primary"}>Get Balance</Button>
                      </Form>

                  </Col>
              </Row>
              <Row>
                  <Col md="12">
                      <div className="mui--text-subhead">Recent Transactions</div>
                      <TransactionsList address={this.state.vaultAddr}/>
                  </Col>
              </Row>
          </Container>
      </div>
    );
  }
}

export default App;


class WithdrawalForm extends Component {

    render() {
        return (
            <Panel>
                <Form inline={true}>
                    <Input label={"Withdrawal Amount"} type={"number"} />
                    <Button color={"primary"}>Withdraw</Button>
                </Form>
            </Panel>
        );
    }
}

class DepositForm extends Component {

    render() {
        return (
            <Panel>
                <Form inline={true}>
                    <Input label={"Deposit Amount"} type={"number"} />
                    <Button color={"accent"}>Deposit</Button>
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
            topics: [['0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364', '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c']]
        })
        console.log('logs returned', logs)

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
        return (
            <Panel>
                <table className="mui-table">
                    <thead>
                    <tr>
                        <th>Block #</th>
                        <th>From</th>
                        <th>Event</th>
                        <th>To</th>
                        <th>Amount</th>
                    </tr>
                    </thead>
                    <tbody>
                    {this.state.messages.map(({address, blockNumber, returnValues: {amount, user}, event, id}) => {
                        return(<tr key={id}>
                            <td>{blockNumber}</td>
                            <td>{isDeposit(event) ? user : isWithdraw(event) ? address : 'n/a'}</td>
                            <td>{event}</td>
                            <td>{isDeposit(event) ? address : isWithdraw(event) ? user : 'n/a'}</td>
                            <td>{amount}</td>
                        </tr>)
                    })}
                    </tbody>
                </table>
            </Panel>
        );
    }
}
