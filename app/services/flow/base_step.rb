module Flow
  class BaseStep
    include Rails.application.routes.url_helpers

    def initialize(flow, name)
      @flow = flow
      @name = name
    end

    def base_call
      form_response = form_submit
      unless form_response.success?
        flow_session[:error_message] = form_response.errors
        return form_response
      end
      create_response(form_response, call)
    end

    def mark_step_complete(step = nil)
      klass = step.nil? ? self.class : steps[step]
      flow_session[klass.to_s] = true
    end

    def mark_step_incomplete(step = nil)
      klass = step.nil? ? self.class : steps[step]
      flow_session.delete(klass.to_s)
    end

    def self.acceptable_response_object?(obj)
      obj.is_a?(FormResponse) || obj.is_a?(DocAuth::Response)
    end

    private

    def create_response(form_submit_response, call_response)
      return form_submit_response unless BaseStep.acceptable_response_object?(call_response)
      call_response.extra.merge!(form_submit_response.extra)
      call_response
    end

    def form_submit
      FormResponse.new(success: true, errors: {})
    end

    def failure(message, extra = nil)
      flow_session[:error_message] = message
      form_response_params = { success: false, errors: { message: message } }
      if extra.present?
        flow_session[:notice] = extra[:notice]
        form_response_params[:extra] = extra unless extra.nil?
      end
      FormResponse.new(form_response_params)
    end

    def flow_params
      params[@name]
    end

    def permit(*args)
      params.require(:doc_auth).permit(*args)
    end

    def redirect_to(url)
      @flow.redirect_to(url)
    end

    def reset
      @flow.flow_session = {}
    end

    delegate :flash, :session, :flow_session, :current_user, :params, :steps, :request, to: :@flow
  end
end
