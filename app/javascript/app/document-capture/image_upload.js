import useCSRF from './hooks/use-csrf';

const imageUploadURI = '/api/verify/upload';

function uploadImages(frontImage, backImage, selfieImage) {
  const csrfToken = useCSRF();
  return new Promise((resolve, reject) => {
    fetch(imageUploadURI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        front: frontImage,
        back: backImage,
        selfie: selfieImage,
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (
          result.status &&
          result.message &&
          ['success', 'error'].includes(result.status)
        ) {
          resolve(result);
        } else {
          reject(Error('Malformed response'));
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

export default uploadImages;