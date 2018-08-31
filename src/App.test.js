import React from 'react';
import App, {WalletOptions, WithdrawOptions, DepositOptions} from './App';
import Option from 'muicss/lib/react/option'

import { shallow, mount } from 'enzyme';

test('renders without crashing', () => {
    shallow(<App/>);
})

test('dropdown will render when accounts is present', () => {
    const wrapper = shallow(<WalletOptions
        updating={false}
        accounts={['0x20203293293029302930293', '0xs3934393949384394830483904']}
        address={'0x20203293293029302930293'}
        onSelect={()=>{}}
        accountsFunc={()=>{}} />)

    expect(wrapper.find('Select').at(0)).toHaveValue("0x20203293293029302930293")
    expect(wrapper).toContainReact(<Option value="0x20203293293029302930293" label="0x20203293293029302930293" className="" />);
    expect(wrapper).toContainReact(<Option value="0xs3934393949384394830483904" label="0xs3934393949384394830483904" className="" />);
});

test('no accounts = no deposit or withdraw options', () => {
    const wrapper = mount(<div>
        <WithdrawOptions
            updating={false}
            address={undefined}
            balance={0}
            onSubmit={()=>{}}
            balanceFunc={()=>{}} />
        <DepositOptions
            updating={false}
            address={undefined}
            balance={0}
            onSubmit={()=>{}}
            balanceFunc={()=>{}} />
    </div>)
    expect(wrapper.find('WithdrawOptions').at(0)).toBeEmptyRender()
    expect(wrapper.find('DepositOptions').at(0)).toBeEmptyRender()
});

test('0 balance = disable button to withdraw/deposit', () => {
    const wrapper = mount(<div>
        <WithdrawOptions
            updating={false}
            address={'0x000000000000000000'}
            balance={0}
            onSubmit={()=>{}}
            balanceFunc={()=>{}} />
        <DepositOptions
            updating={false}
            address={'0x000000000000000000'}
            balance={0}
            onSubmit={()=>{}}
            balanceFunc={()=>{}} />
    </div>)
    expect(wrapper.find('WithdrawOptions').at(0).find('.actions Button').at(0)).toBeDisabled()
    expect(wrapper.find('DepositOptions').at(0).find('.actions Button').at(0)).toBeDisabled()
});
