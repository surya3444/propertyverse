const { pickFields, isObjectId } = require('../ownership');

describe('pickFields', () => {
  const EDITABLE = ['clientName', 'status'];

  it('copies only allowlisted keys', () => {
    expect(pickFields({ clientName: 'Asha', status: 'New' }, EDITABLE)).toEqual({
      clientName: 'Asha',
      status: 'New',
    });
  });

  it('drops agentId, which is how a lead could be handed to another agent', () => {
    const hostile = { clientName: 'Asha', agentId: '6a507ffa538999fd17e17224' };
    const update = pickFields(hostile, EDITABLE);
    expect(update).not.toHaveProperty('agentId');
    expect(update).toEqual({ clientName: 'Asha' });
  });

  it('leaves absent keys absent so a partial update does not unset fields', () => {
    expect(pickFields({ status: 'Closed' }, EDITABLE)).toEqual({ status: 'Closed' });
  });

  it('survives a non-object body', () => {
    expect(pickFields(null, EDITABLE)).toEqual({});
    expect(pickFields('nope', EDITABLE)).toEqual({});
  });
});

describe('isObjectId', () => {
  it('accepts a canonical 24-char hex id', () => {
    expect(isObjectId('6a507ffa538999fd17e17224')).toBe(true);
  });

  it('rejects the 12-character strings mongoose.isValidObjectId would accept', () => {
    expect(isObjectId('aaaaaaaaaaaa')).toBe(false);
    expect(isObjectId('')).toBe(false);
    expect(isObjectId(undefined)).toBe(false);
  });
});
