// test ethers BigNumber user case

import assert from 'assert';
import { BigNumber, utils } from 'ethers';

function testFormatUnits() {
  let a = BigNumber.from('0');
  let b = BigNumber.from('0');
  let c = BigNumber.from('0');
  let m = BigNumber.from('0');

  m = BigNumber.from('22010000000000000000003');

  a = BigNumber.from('00000000000000000000001');
  b = BigNumber.from('00000000000000000000002');
  c = BigNumber.from('22010000000000000000000');

  // a2: 0.000000000000000000000045433
  let a2 = utils.formatUnits(a.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m), 18 + 5 + 4);
  assert.strictEqual(a2, '0.000000000000000000000045433');

  // 0.000000000000000000000090867
  let b2 = utils.formatUnits(b.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m), 18 + 5 + 4);
  assert.strictEqual(b2, '0.000000000000000000000090867');

  // 0.999999999999999999999863698
  let c2 = utils.formatUnits(c.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m), 18 + 5 + 4);
  assert.strictEqual(c2, '0.999999999999999999999863698');

  console.log('a2:', a2);
  console.log('b2:', b2);
  console.log('c2:', c2);

  // BigNumber only support integer. initialize with float will throw error.
  // const error = BigNumber.from(a2);
  assert.throws(() => {
    BigNumber.from(a2);
  });
}

function testCase01() {
  let m = BigNumber.from('22010000000000000000003');

  let a = BigNumber.from('00000000000000000000001');
  let b = BigNumber.from('00000000000000000000002');
  let c = BigNumber.from('22010000000000000000000');

  let a2 = a.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m);
  let b2 = b.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m);
  let c2 = c.mul(BigNumber.from(10).pow(18 + 5 + 4)).div(m);
  console.log('a2:', a2.toString());
  console.log('b2:', b2.toString());
  console.log('c2:', c2.toString());

  const multi = BigNumber.from('500');

  console.log(
    'take a2:',
    a2
      .mul(multi)
      .div(BigNumber.from(10).pow(18 + 5 + 4))
      .toString()
  );
  console.log(
    'take b2:',
    b2
      .mul(multi)
      .div(BigNumber.from(10).pow(18 + 5 + 4))
      .toString()
  );
  console.log(
    'take c2:',
    c2
      .mul(multi)
      .div(BigNumber.from(10).pow(18 + 5 + 4))
      .toString()
  );
}

function _eventlyDivide() {
  class IndexerAllocationSummary {
    id?: string;
    projectId?: string;
    deploymentId?: string;
    indexerId?: string;
    totalAdded?: bigint;
    totalRemoved?: bigint;
    totalAmount?: bigint;
    createAt?: Date;
    updateAt?: Date;
  }

  // prettier-ignore
  const allocation = {
    total: BigNumber.from('21910000000000000000000'),
    used:  BigNumber.from('21910000000000000000001'),
  };

  const d1 = BigInt('1');
  const d2 = BigInt('2');
  const d3 = allocation.used.toBigInt() - d1 - d2;

  assert(allocation.used.eq(BigNumber.from(d1 + d2 + d3)));

  // total reduce
  // const expectTotalReduce = allocation.used.sub(allocation.total);
  const expectTotalReduce = BigNumber.from('500');
  console.log('expectTotalReduce:', expectTotalReduce.toString());

  // denominator wei count
  const fenmu = allocation.used;
  const fenmuLength = allocation.used.toString().length;

  const deploymentAllocations: IndexerAllocationSummary[] = [
    { deploymentId: 'd1', totalAmount: d1 },
    { deploymentId: 'd2', totalAmount: d2 },
    { deploymentId: 'd3', totalAmount: d3 },
  ];

  deploymentAllocations.sort((a, b) => {
    return a.totalAmount < b.totalAmount ? -1 : 1;
  });

  let calcTotalReduce = BigNumber.from(0);
  const calSingleReduce = [];
  for (const d of deploymentAllocations) {
    let calc = BigNumber.from(d.totalAmount)
      .mul(BigNumber.from(10).pow(fenmuLength + 4))
      .div(fenmu);
    calc = expectTotalReduce.mul(calc).div(BigNumber.from(10).pow(fenmuLength + 4));
    calcTotalReduce = calcTotalReduce.add(calc);
    console.log(
      'take from d:',
      d.deploymentId,
      'totalAmount:',
      d.totalAmount,
      'calc:',
      calc.toString()
    );
    calSingleReduce.push(calc);
  }
  let rest = expectTotalReduce.sub(calcTotalReduce);
  console.log(
    'expectTotalReduce:',
    expectTotalReduce,
    ' calcTotalReduce:',
    calcTotalReduce.toString(),
    ' rest:',
    rest.toString()
  );

  console.log('before adjust:', calSingleReduce.map((v) => v.toString()));
  for (let i = deploymentAllocations.length - 1; i >= 0; i--) {
    if (rest.eq(BigNumber.from(0))) {
      break;
    }
    let d = deploymentAllocations[i];

    if (BigNumber.from(d.totalAmount).gte(calSingleReduce[i].add(rest))) {
      calSingleReduce[i] = calSingleReduce[i].add(rest);
      break;
    }

    const diff = BigNumber.from(d.totalAmount).sub(calSingleReduce[i]);
    calSingleReduce[i] = calSingleReduce[i].add(diff);
    rest = rest.sub(diff);
  }
  console.log('after adjust:', calSingleReduce.map((v) => v.toString()));

  const xsum = calSingleReduce.reduce((acc, cur) => acc.add(cur), BigNumber.from(0));
  assert(expectTotalReduce.eq(xsum));
}

// testFormatUnits();
// testCase01();
_eventlyDivide();
