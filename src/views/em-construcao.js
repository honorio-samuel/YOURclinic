import React from 'react';

import Card from '../components/card';

function EmConstrucao(props) {
  return (
    <Card title={props.title}>
      <p className='mb-0'>Tela em construção.</p>
    </Card>
  );
}

export default EmConstrucao;
