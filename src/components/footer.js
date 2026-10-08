import React from 'react';

function Footer(props) {
  return (
    <footer className='container my-4'>
      <div className='row justify-content-center'>
        <div className='col-md-6 bg-primary text-white text-center small p-3'>
          {props.contato}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
