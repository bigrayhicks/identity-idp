require 'rails_helper'

describe Idv::ImageUploadsController do
  describe '#create' do
    before do
      sign_in_as_user
      controller.current_user.document_capture_sessions.create!
    end

    subject(:action) { post :create, params: params }

    let(:document_capture_session) { controller.current_user.document_capture_sessions.last }
    let(:params) do
      {
        front: DocAuthImageFixtures.document_front_image_multipart,
        back: DocAuthImageFixtures.document_back_image_multipart,
        selfie: DocAuthImageFixtures.selfie_image_multipart,
        document_capture_session_uuid: document_capture_session.uuid,
      }
    end

    context 'when document capture is not enabled' do
      before do
        allow(FeatureManagement).to receive(:document_capture_step_enabled?).and_return(false)
      end

      it 'disables the endpoint' do
        action
        expect(response).to be_not_found
      end
    end

    context 'when document capture is enabled' do
      before do
        allow(FeatureManagement).to receive(:document_capture_step_enabled?).and_return(true)
      end

      context 'when fields are missing' do
        before { params.delete(:front) }

        it 'returns error status when not provided image fields' do
          action

          json = JSON.parse(response.body, symbolize_names: true)
          expect(json[:success]).to eq(false)
          expect(json[:errors]).to eq(['Front of your ID Please fill in this field.'])
        end
      end

      context 'when a value is not a file' do
        before { params.merge!(front: 'some string') }

        it 'returns an error' do
          action

          json = JSON.parse(response.body, symbolize_names: true)
          expect(json[:errors]).
            to eq(["Front of your ID #{I18n.t('doc_auth.errors.not_a_file')}"])
        end

        context 'with a locale param' do
          before { params.merge!(locale: 'es') }

          it 'translates errors using the locale param' do
            action

            json = JSON.parse(response.body, symbolize_names: true)
            expect(json[:errors]).
              to eq(['Frente de su identificación ' +
                      I18n.t('doc_auth.errors.not_a_file', locale: 'es')])
          end
        end
      end

      context 'when image upload succeeds' do
        it 'returns a successful response and modifies the session' do
          action

          json = JSON.parse(response.body, symbolize_names: true)
          expect(json[:success]).to eq(true)

          expect(document_capture_session.reload.load_result.success?).to eq(true)
        end
      end

      context 'when image upload fails' do
        before do
          DocAuth::Mock::DocAuthMockClient.mock_response!(
            method: :post_images,
            response: DocAuth::Response.new(
              success: false,
              errors: ['Too blurry', 'Wrong document'],
            ),
          )
        end

        it 'returns an error response' do
          action

          json = JSON.parse(response.body, symbolize_names: true)
          expect(json[:success]).to eq(false)
          expect(json[:errors]).to eq(['Too blurry', 'Wrong document'])
        end
      end
    end
  end
end
