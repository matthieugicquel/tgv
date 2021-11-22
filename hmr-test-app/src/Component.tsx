import React, { useState } from 'react';

export function Component() {
  const [checked, setChecked] = useState(false);

  const handleChange = () => {
    setChecked(!checked);
  };

  return (
    <div>
      <h1>Hello, world! 2</h1>
      <input type="checkbox" checked={checked} onChange={handleChange} />
    </div>
  );
}

export const TRUC = 3;
