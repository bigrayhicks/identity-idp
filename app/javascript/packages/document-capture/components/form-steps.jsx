import React, { useEffect, useRef, useState } from 'react';
import Button from './button';
import PageHeading from './page-heading';
import useI18n from '../hooks/use-i18n';
import useHistoryParam from '../hooks/use-history-param';

/** @typedef {import('react').FunctionComponent} FunctionComponent */

/**
 * @template {Record<string,any>} V
 *
 * @typedef {Partial<Record<keyof V,Error>>} FormStepValidateResult
 */

/**
 * @template {Record<string,any>} V
 *
 * @typedef {(values:V)=>undefined|FormStepValidateResult<V>} FormStepValidate
 */

/**
 * @typedef FormStep
 *
 * @prop {string} name Step name, used in history parameter.
 * @prop {string} title Step title, shown as heading.
 * @prop {FunctionComponent} component Step component implementation.
 * @prop {FormStepValidate<Record<string,any>>} validate Step validity function. Given set of form
 * values, returns an object with keys from form values mapped to an error, if applicable. Returns
 * undefined or an empty object if there are no errors.
 */

/**
 * @typedef FormStepsProps
 *
 * @prop {FormStep[]=} steps Form steps.
 * @prop {Record<string,any>=} initialValues Form values to populate initial state.
 * @prop {string=} initialStep Step to start from.
 * @prop {(values:Record<string,any>)=>void=} onComplete Form completion callback.
 */

/**
 * An error representing a state where a required form value is missing.
 */
export class RequiredValueMissingError extends Error {}

/**
 * Given a step object and current set of form values, returns true if the form values would satisfy
 * the validity requirements of the step.
 *
 * @param {FormStep} step Form step.
 * @param {Record<string,any>} values Current form values.
 */
function getValidationErrors(step, values) {
  const { validate = () => undefined } = step;
  return validate(values);
}

/**
 * Given a step object and current set of form values, returns true if the form values would satisfy
 * the validity requirements of the step.
 *
 * @param {FormStep} step Form step.
 * @param {Record<string,any>} values Current form values.
 */
export function isStepValid(step, values) {
  const errors = getValidationErrors(step, values);
  return !errors || !Object.keys(errors).length;
}

/**
 * Returns the index of the step in the array which matches the given name. Returns `-1` if there is
 * no step found by that name.
 *
 * @param {FormStep[]} steps Form steps.
 * @param {string}     name  Step to search.
 *
 * @return {number} Step index.
 */
export function getStepIndexByName(steps, name) {
  return steps.findIndex((step) => step.name === name);
}

/**
 * Returns the index of the last step in the array where the values satisfy the requirements of the
 * step. If all steps are valid, returns the index of the last member. Returns `-1` if all steps are
 * invalid, or if the array is empty.
 *
 * @param {FormStep[]} steps  Form steps.
 * @param {object}     values Current form values.
 *
 * @return {number} Step index.
 */
export function getLastValidStepIndex(steps, values) {
  const index = steps.findIndex((step) => !isStepValid(step, values));
  return index === -1 ? steps.length - 1 : index - 1;
}

/**
 * @param {FormStepsProps} props Props object.
 */
function FormSteps({ steps = [], onComplete = () => {}, initialValues = {}, initialStep }) {
  const [values, setValues] = useState(initialValues);
  const [activeErrors, setActiveErrors] = useState(
    /** @type {FormStepValidateResult<Record<string,Error>>=} */ (undefined),
  );
  const formRef = useRef(/** @type {?HTMLFormElement} */ (null));
  const headingRef = useRef(/** @type {?HTMLHeadingElement} */ (null));
  const [stepName, setStepName] = useHistoryParam('step', initialStep);
  const { t } = useI18n();

  // An "effective" step is computed in consideration of the facts that (1) there may be no history
  // parameter present, in which case the first step should be used, and (2) the values may not be
  // valid for previous steps, in which case the furthest valid step should be set.
  const effectiveStepIndex = Math.max(
    Math.min(getStepIndexByName(steps, stepName), getLastValidStepIndex(steps, values) + 1),
    0,
  );
  const effectiveStep = steps[effectiveStepIndex];
  useEffect(() => {
    // The effective step is used in the initial render, but since it may be out of sync with the
    // history parameter, it is synced after mount.
    if (effectiveStep && stepName && effectiveStep.name !== stepName) {
      setStepName(effectiveStep.name);
    }

    // Treat explicit initial step the same as step transition, placing focus to header.
    if (initialStep && headingRef.current) {
      headingRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Errors are assigned at the first attempt to submit. Once errors are assigned, track value
    // changes to remove validation errors as they become resolved.
    if (activeErrors) {
      const nextActiveErrors = getValidationErrors(effectiveStep, values);
      setActiveErrors(nextActiveErrors);
    }
  }, [values]);

  // An empty steps array is allowed, in which case there is nothing to render.
  if (!effectiveStep) {
    return null;
  }

  /**
   * Increments state to the next step, or calls onComplete callback if the current step is the last
   * step.
   *
   * @type {import('react').FormEventHandler}
   */
  function toNextStep(event) {
    event.preventDefault();

    const nextActiveErrors = getValidationErrors(effectiveStep, values);
    setActiveErrors(nextActiveErrors);
    if (nextActiveErrors && Object.keys(nextActiveErrors).length) {
      return;
    }

    const nextStepIndex = effectiveStepIndex + 1;
    const isComplete = nextStepIndex === steps.length;
    if (isComplete) {
      // Clear step parameter from URL.
      setStepName(null);
      onComplete(values);
    } else {
      const { name: nextStepName } = steps[nextStepIndex];
      setStepName(nextStepName);
    }

    headingRef.current?.focus();
  }

  const { component: Component, name, title } = effectiveStep;
  const isLastStep = effectiveStepIndex + 1 === steps.length;

  return (
    <form ref={formRef} onSubmit={toNextStep}>
      <PageHeading key="title" ref={headingRef} tabIndex={-1}>
        {title}
      </PageHeading>
      <Component
        key={name}
        value={values}
        errors={activeErrors}
        onChange={(nextValuesPatch) => {
          setValues((prevValues) => ({ ...prevValues, ...nextValuesPatch }));
        }}
      />
      <Button type="submit" isPrimary className="margin-y-5">
        {t(isLastStep ? 'forms.buttons.submit.default' : 'forms.buttons.continue')}
      </Button>
    </form>
  );
}

export default FormSteps;
